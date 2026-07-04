import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { LOCAL_USER_ID } from "@/lib/user";

export type AuthenticatedActor =
  | { kind: "user"; userId: string; authProvider: "local" | "apple" }
  | { kind: "device"; userId: string; deviceId: string; authProvider: "device_token" };

export function getLocalActor(): AuthenticatedActor {
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

  return { kind: "device", userId: device.userId, deviceId: device.id, authProvider: "device_token" };
}

export async function touchDeviceLastSyncedAt(deviceId: string, db: DeviceAuthDb = prisma) {
  await db.device.update({
    where: { id: deviceId },
    data: { lastSyncedAt: new Date() },
  });
}
