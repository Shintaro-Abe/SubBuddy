import { randomBytes, randomUUID } from "node:crypto";
import type { AuthClientType } from "@prisma/client";
import type { CloudAuthConfig } from "@/config/auth";
import { prisma } from "@/lib/prisma";
import { hashDeviceSyncToken, type AuthenticatedActor } from "@/lib/auth";
import type { AppleIdentity } from "@/lib/apple-auth";
import { generateRefreshToken, hashRefreshToken, issueAccessToken } from "@/lib/session-tokens";

type UserRecord = {
  id: string;
};

type DeviceRecord = {
  id: string;
  name: string | null;
};

type AuthDb = {
  user: {
    upsert(args: {
      where: { appleSubjectHash: string };
      create: { name: string; appleSubjectHash: string; lastSignedInAt: Date };
      update: { lastSignedInAt: Date };
      select: { id: true };
    }): Promise<UserRecord>;
    deleteMany(args: { where: { appleSubjectHash: string } }): Promise<{ count: number }>;
  };
  device: {
    create(args: {
      data: { userId: string; clientDeviceId?: string; name?: string; tokenHash: string };
      select: { id: true; name: true };
    }): Promise<DeviceRecord>;
    upsert(args: {
      where: { userId_clientDeviceId: { userId: string; clientDeviceId: string } };
      create: { userId: string; clientDeviceId: string; name?: string; tokenHash: string };
      update: { name?: string; tokenHash: string; revokedAt: null };
      select: { id: true; name: true };
    }): Promise<DeviceRecord>;
    updateMany(args: {
      where: { id: string; userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
  };
};

export type RegisteredDevice = {
  device: DeviceRecord;
  deviceSyncToken: string;
};

type SessionAuthDb = Pick<typeof prisma, "authSession">;

export type IssuedSession = {
  sessionId: string;
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshIdleExpiresAt: Date;
  refreshAbsoluteExpiresAt: Date;
};

export type CreateSessionInput = {
  userId: string;
  clientType: AuthClientType;
  deviceId?: string;
  rememberBrowser?: boolean;
};

export class RefreshSessionError extends Error {
  constructor() {
    super("refresh session rejected");
    this.name = "RefreshSessionError";
  }
}

class RotationConflictError extends Error {
  constructor(readonly tokenFamilyId: string) {
    super("refresh rotation conflict");
  }
}

export async function createAuthSession(
  input: CreateSessionInput,
  config: CloudAuthConfig,
  db: SessionAuthDb = prisma,
  now = new Date(),
  refreshTokenFactory = generateRefreshToken,
  idFactory: () => string = randomUUID,
): Promise<IssuedSession> {
  const sessionId = idFactory();
  const tokenFamilyId = idFactory();
  const refreshToken = refreshTokenFactory();
  const usesLongLivedSession = input.clientType === "ios" || input.rememberBrowser === true;
  const idleTtlSeconds = usesLongLivedSession ? config.idleTtlSeconds : config.webSessionTtlSeconds;
  const absoluteTtlSeconds = usesLongLivedSession
    ? config.absoluteTtlSeconds
    : config.webSessionTtlSeconds;
  const refreshIdleExpiresAt = new Date(now.getTime() + idleTtlSeconds * 1000);
  const refreshAbsoluteExpiresAt = new Date(now.getTime() + absoluteTtlSeconds * 1000);
  const access = await issueAccessToken(input.userId, sessionId, config, now);

  await db.authSession.create({
    data: {
      id: sessionId,
      userId: input.userId,
      clientType: input.clientType,
      tokenFamilyId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      deviceId: input.deviceId,
      rememberBrowser: input.rememberBrowser === true,
      lastUsedAt: now,
      idleExpiresAt: refreshIdleExpiresAt,
      absoluteExpiresAt: refreshAbsoluteExpiresAt,
    },
  });

  return {
    sessionId,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken,
    refreshIdleExpiresAt,
    refreshAbsoluteExpiresAt,
  };
}

export async function rotateAuthSession(
  refreshToken: string,
  config: CloudAuthConfig,
  db: Pick<typeof prisma, "$transaction" | "authSession"> = prisma,
  now = new Date(),
  refreshTokenFactory = generateRefreshToken,
  idFactory: () => string = randomUUID,
): Promise<IssuedSession> {
  const presentedTokenHash = hashRefreshToken(refreshToken);
  const nextRefreshToken = refreshTokenFactory();
  const nextSessionId = idFactory();

  try {
    const result = await db.$transaction(async (tx) => {
      const current = await tx.authSession.findUnique({
        where: { refreshTokenHash: presentedTokenHash },
        select: {
          id: true,
          userId: true,
          clientType: true,
          tokenFamilyId: true,
          deviceId: true,
          rememberBrowser: true,
          replacedBySessionId: true,
          idleExpiresAt: true,
          absoluteExpiresAt: true,
          revokedAt: true,
        },
      });
      if (!current) return null;

      if (current.replacedBySessionId) {
        await tx.authSession.updateMany({
          where: { tokenFamilyId: current.tokenFamilyId, revokedAt: null },
          data: { revokedAt: now, revokeReason: "refresh_token_reuse" },
        });
        return null;
      }

      if (current.revokedAt || current.idleExpiresAt <= now || current.absoluteExpiresAt <= now) {
        return null;
      }

      const usesLongLivedSession = current.clientType === "ios" || current.rememberBrowser === true;
      const idleTtlSeconds = usesLongLivedSession
        ? config.idleTtlSeconds
        : config.webSessionTtlSeconds;
      const candidateIdleExpiry = new Date(now.getTime() + idleTtlSeconds * 1000);
      const nextIdleExpiresAt =
        candidateIdleExpiry < current.absoluteExpiresAt
          ? candidateIdleExpiry
          : current.absoluteExpiresAt;

      await tx.authSession.create({
        data: {
          id: nextSessionId,
          userId: current.userId,
          clientType: current.clientType,
          tokenFamilyId: current.tokenFamilyId,
          refreshTokenHash: hashRefreshToken(nextRefreshToken),
          deviceId: current.deviceId,
          rememberBrowser: current.rememberBrowser,
          lastUsedAt: now,
          idleExpiresAt: nextIdleExpiresAt,
          absoluteExpiresAt: current.absoluteExpiresAt,
        },
      });

      const consumed = await tx.authSession.updateMany({
        where: {
          id: current.id,
          refreshTokenHash: presentedTokenHash,
          replacedBySessionId: null,
          revokedAt: null,
        },
        data: {
          replacedBySessionId: nextSessionId,
          revokedAt: now,
          revokeReason: "rotated",
          lastUsedAt: now,
        },
      });
      if (consumed.count !== 1) throw new RotationConflictError(current.tokenFamilyId);

      return {
        userId: current.userId,
        idleExpiresAt: nextIdleExpiresAt,
        absoluteExpiresAt: current.absoluteExpiresAt,
      };
    });

    if (!result) throw new RefreshSessionError();
    const access = await issueAccessToken(result.userId, nextSessionId, config, now);
    return {
      sessionId: nextSessionId,
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: nextRefreshToken,
      refreshIdleExpiresAt: result.idleExpiresAt,
      refreshAbsoluteExpiresAt: result.absoluteExpiresAt,
    };
  } catch (error) {
    if (error instanceof RotationConflictError) {
      await db.authSession.updateMany({
        where: { tokenFamilyId: error.tokenFamilyId, revokedAt: null },
        data: { revokedAt: now, revokeReason: "refresh_token_reuse" },
      });
      throw new RefreshSessionError();
    }
    if (error instanceof RefreshSessionError) throw error;
    throw error;
  }
}

export async function upsertAppleUser(
  identity: Pick<AppleIdentity, "subjectHash">,
  db: AuthDb = prisma,
): Promise<AuthenticatedActor> {
  const now = new Date();
  const user = await db.user.upsert({
    where: { appleSubjectHash: identity.subjectHash },
    create: {
      name: "Apple user",
      appleSubjectHash: identity.subjectHash,
      lastSignedInAt: now,
    },
    update: { lastSignedInAt: now },
    select: { id: true },
  });

  return { kind: "user", userId: user.id, authProvider: "apple" };
}

export async function deleteAppleUserAccount(
  identity: Pick<AppleIdentity, "subjectHash">,
  db: AuthDb = prisma,
): Promise<boolean> {
  const result = await db.user.deleteMany({
    where: { appleSubjectHash: identity.subjectHash },
  });
  return result.count > 0;
}

export function generateDeviceSyncToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function registerDeviceForAppleUser(
  userId: string,
  deviceName: string | undefined,
  clientDeviceId: string | undefined,
  db: AuthDb = prisma,
  tokenFactory = generateDeviceSyncToken,
): Promise<RegisteredDevice> {
  const deviceSyncToken = tokenFactory();
  const deviceData = {
    userId,
    clientDeviceId,
    name: deviceName,
    tokenHash: hashDeviceSyncToken(deviceSyncToken),
  };

  const device = clientDeviceId
    ? await db.device.upsert({
        where: { userId_clientDeviceId: { userId, clientDeviceId } },
        create: {
          ...deviceData,
          clientDeviceId,
        },
        update: {
          name: deviceName,
          tokenHash: deviceData.tokenHash,
          revokedAt: null,
        },
        select: { id: true, name: true },
      })
    : await db.device.create({
        data: {
          userId,
          name: deviceName,
          tokenHash: deviceData.tokenHash,
        },
        select: { id: true, name: true },
      });

  return { device, deviceSyncToken };
}

export async function revokeDeviceForAppleUser(
  userId: string,
  deviceId: string,
  db: AuthDb = prisma,
): Promise<boolean> {
  const result = await db.device.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
