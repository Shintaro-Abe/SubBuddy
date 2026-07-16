import { createHash, timingSafeEqual } from "node:crypto";
import type { CloudAuthConfig } from "@/config/auth";
import { isAppleOutageAccessAllowed, parseAuthConfig } from "@/config/auth";
import { prisma } from "@/lib/prisma";
import { AccessTokenError, verifyAccessToken } from "@/lib/session-tokens";
import { LOCAL_USER_ID } from "@/lib/user";

export type AuthenticatedActor =
  | { kind: "user"; userId: string; authProvider: "local" | "apple" }
  | { kind: "device"; userId: string; deviceId: string; authProvider: "device_token" };

export type AuthenticatedRequest = {
  actor: Extract<AuthenticatedActor, { kind: "user" }>;
  sessionId: string | null;
  transport: "local" | "bearer" | "cookie";
};

export type RequestAuthRejectionReason =
  | "credential_missing"
  | "access_token_invalid"
  | "session_missing"
  | "session_user_mismatch"
  | "session_revoked"
  | "session_idle_expired"
  | "session_absolute_expired"
  | "apple_outage_family_missing"
  | "apple_outage_grace_expired";

export type RequestAuthRejectionReporter = (reason: RequestAuthRejectionReason) => void;

export function getLocalActor(): Extract<AuthenticatedActor, { kind: "user" }> {
  return { kind: "user", userId: LOCAL_USER_ID, authProvider: "local" };
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(\S+)$/.exec(authorizationHeader);
  return match?.[1] ?? null;
}

export function hashDeviceSyncToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name && !cookies.has(name)) cookies.set(name, value);
  }
  return cookies;
}

export function readCookie(req: Request, name: string): string | null {
  return parseCookieHeader(req.headers.get("cookie")).get(name) ?? null;
}

type SessionRequestAuthDb = Pick<typeof prisma, "authSession">;

export async function authenticateRequest(
  req: Request,
  db: SessionRequestAuthDb = prisma,
  now = new Date(),
  reportRejection?: RequestAuthRejectionReporter,
): Promise<AuthenticatedRequest | null> {
  const config = parseAuthConfig();
  if (config.mode === "local") {
    return { actor: getLocalActor(), sessionId: null, transport: "local" };
  }

  const bearerToken = extractBearerToken(req.headers.get("authorization"));
  const accessToken = bearerToken ?? readCookie(req, config.accessCookieName);
  if (!accessToken) {
    reportRejection?.("credential_missing");
    return null;
  }

  try {
    const claims = await verifyAccessToken(accessToken, config, now);
    const session = await db.authSession.findUnique({
      where: { id: claims.sessionId },
      select: {
        userId: true,
        revokedAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        tokenFamilyId: true,
      },
    });
    if (!session) {
      reportRejection?.("session_missing");
      return null;
    }
    if (session.userId !== claims.userId) {
      reportRejection?.("session_user_mismatch");
      return null;
    }
    if (session.revokedAt) {
      reportRejection?.("session_revoked");
      return null;
    }
    if (session.idleExpiresAt <= now) {
      reportRejection?.("session_idle_expired");
      return null;
    }
    if (session.absoluteExpiresAt <= now) {
      reportRejection?.("session_absolute_expired");
      return null;
    }
    if (config.appleOutageStartedAt) {
      const familyRoot = await db.authSession.findFirst({
        where: { tokenFamilyId: session.tokenFamilyId },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      if (!familyRoot) {
        reportRejection?.("apple_outage_family_missing");
        return null;
      }
      if (!isAppleOutageAccessAllowed(config, familyRoot.createdAt, now)) {
        reportRejection?.("apple_outage_grace_expired");
        return null;
      }
    }
    return {
      actor: { kind: "user", userId: claims.userId, authProvider: "apple" },
      sessionId: claims.sessionId,
      transport: bearerToken ? "bearer" : "cookie",
    };
  } catch (error) {
    if (error instanceof AccessTokenError) {
      reportRejection?.("access_token_invalid");
      return null;
    }
    throw error;
  }
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasAllowedOrigin(req: Request, config: CloudAuthConfig): boolean {
  const origin = req.headers.get("origin");
  return origin !== null && config.allowedOrigins.includes(origin);
}

export function hasValidCsrfToken(req: Request, config: CloudAuthConfig): boolean {
  const cookieToken = readCookie(req, config.csrfCookieName);
  const headerToken = req.headers.get("x-csrf-token");
  return Boolean(cookieToken && headerToken && constantTimeStringEqual(cookieToken, headerToken));
}

export function authorizeStateChange(
  req: Request,
  auth: AuthenticatedRequest,
  config: CloudAuthConfig,
): boolean {
  if (auth.transport === "local" || auth.transport === "bearer") return true;
  return hasAllowedOrigin(req, config) && hasValidCsrfToken(req, config);
}

export function verifyStaticBearerToken(
  authorizationHeader: string | null,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) return false;
  const providedToken = extractBearerToken(authorizationHeader);
  if (!providedToken) return false;

  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

type DeviceAuthDb = Pick<typeof prisma, "device">;

export async function authenticateDeviceSyncToken(
  authorizationHeader: string | null,
  db: DeviceAuthDb = prisma,
): Promise<AuthenticatedActor | null> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) return null;

  const tokenHash = hashDeviceSyncToken(token);
  const device = await db.device.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!device || device.revokedAt) return null;

  return {
    kind: "device",
    userId: device.userId,
    deviceId: device.id,
    authProvider: "device_token",
  };
}

export async function touchDeviceLastSyncedAt(deviceId: string, db: DeviceAuthDb = prisma) {
  await db.device.update({
    where: { id: deviceId },
    data: { lastSyncedAt: new Date() },
  });
}
