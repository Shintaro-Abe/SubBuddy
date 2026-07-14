import { randomBytes, randomUUID } from "node:crypto";
import type { AuthClientType } from "@prisma/client";
import { isAppleOutageAccessAllowed, type CloudAuthConfig } from "@/config/auth";
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

type SessionAuthDb = Pick<typeof prisma, "$transaction" | "authSession">;
type AppleSessionExchangeDb = Pick<AuthDb, "user"> & SessionAuthDb;
const MAX_ACTIVE_SESSIONS = 10;

export type IssuedSession = {
  sessionId: string;
  clientType: AuthClientType;
  rememberBrowser: boolean;
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

export type AppleSessionExchange = {
  actor: AuthenticatedActor;
  session: IssuedSession;
};

export class RefreshSessionError extends Error {
  constructor() {
    super("refresh session rejected");
    this.name = "RefreshSessionError";
  }
}

export class SessionLimitError extends Error {
  constructor() {
    super("active session limit reached");
    this.name = "SessionLimitError";
  }
}

export class AppleOutageError extends Error {
  constructor() {
    super("Apple sign-in is temporarily unavailable");
    this.name = "AppleOutageError";
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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await db.$transaction(
        async (tx) => {
          const activeSessions = await tx.authSession.count({
            where: {
              userId: input.userId,
              revokedAt: null,
              idleExpiresAt: { gt: now },
              absoluteExpiresAt: { gt: now },
            },
          });
          if (activeSessions >= MAX_ACTIVE_SESSIONS) throw new SessionLimitError();
          await tx.authSession.create({
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
        },
        { isolationLevel: "Serializable" },
      );
      break;
    } catch (error) {
      if (error instanceof SessionLimitError) throw error;
      const isSerializationConflict =
        typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
      if (!isSerializationConflict || attempt === 2) throw error;
    }
  }

  return {
    sessionId,
    clientType: input.clientType,
    rememberBrowser: input.rememberBrowser === true,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken,
    refreshIdleExpiresAt,
    refreshAbsoluteExpiresAt,
  };
}

export type SessionSummary = {
  id: string;
  clientType: AuthClientType;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
};

export async function listActiveSessions(
  userId: string,
  currentSessionId: string | null,
  db: SessionAuthDb = prisma,
  now = new Date(),
): Promise<SessionSummary[]> {
  const sessions = await db.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      idleExpiresAt: { gt: now },
      absoluteExpiresAt: { gt: now },
    },
    select: {
      id: true,
      clientType: true,
      createdAt: true,
      lastUsedAt: true,
      device: { select: { name: true } },
    },
    orderBy: { lastUsedAt: "desc" },
  });
  return sessions.map((session) => ({
    id: session.id,
    clientType: session.clientType,
    deviceName: session.device?.name ?? null,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    current: session.id === currentSessionId,
  }));
}

type SessionRevocationDb = Pick<typeof prisma, "$transaction" | "authSession" | "device">;

export async function revokeSession(
  userId: string,
  sessionId: string,
  reason: string,
  db: SessionRevocationDb = prisma,
  now = new Date(),
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const session = await tx.authSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { deviceId: true },
    });
    if (!session) return false;
    await tx.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    if (session.deviceId) {
      await tx.device.updateMany({
        where: { id: session.deviceId, userId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    return true;
  });
}

export async function revokeAllSessionsAndDevices(
  userId: string,
  reason: string,
  db: SessionRevocationDb = prisma,
  now = new Date(),
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    await tx.device.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  });
}

export async function attachDeviceToSession(
  userId: string,
  sessionId: string,
  deviceId: string,
  db: SessionAuthDb = prisma,
): Promise<boolean> {
  const result = await db.authSession.updateMany({
    where: { id: sessionId, userId, clientType: "ios", revokedAt: null },
    data: { deviceId },
  });
  return result.count === 1;
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
      if (config.appleOutageStartedAt) {
        const familyRoot = await tx.authSession.findFirst({
          where: { tokenFamilyId: current.tokenFamilyId },
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        if (!familyRoot || !isAppleOutageAccessAllowed(config, familyRoot.createdAt, now)) {
          return null;
        }
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
        clientType: current.clientType,
        rememberBrowser: current.rememberBrowser,
        idleExpiresAt: nextIdleExpiresAt,
        absoluteExpiresAt: current.absoluteExpiresAt,
      };
    });

    if (!result) throw new RefreshSessionError();
    const access = await issueAccessToken(result.userId, nextSessionId, config, now);
    return {
      sessionId: nextSessionId,
      clientType: result.clientType,
      rememberBrowser: result.rememberBrowser,
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
  db: Pick<AuthDb, "user"> = prisma,
  now = new Date(),
): Promise<AuthenticatedActor> {
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

export async function exchangeAppleIdentityForSession(
  identity: Pick<AppleIdentity, "subjectHash">,
  input: Omit<CreateSessionInput, "userId">,
  config: CloudAuthConfig,
  db: AppleSessionExchangeDb = prisma,
  now = new Date(),
): Promise<AppleSessionExchange> {
  if (config.appleOutageStartedAt) throw new AppleOutageError();
  const actor = await upsertAppleUser(identity, db, now);
  const session = await createAuthSession({ ...input, userId: actor.userId }, config, db, now);
  return { actor, session };
}

export async function appleIdentityBelongsToUser(
  identity: Pick<AppleIdentity, "subjectHash">,
  userId: string,
  db: Pick<typeof prisma, "user"> = prisma,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { appleSubjectHash: identity.subjectHash },
    select: { id: true },
  });
  return user?.id === userId;
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

export async function revokeDeviceAndSessions(
  userId: string,
  deviceId: string,
  db: SessionRevocationDb = prisma,
  now = new Date(),
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const device = await tx.device.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (device.count !== 1) return false;
    await tx.authSession.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: now, revokeReason: "device_revoked" },
    });
    return true;
  });
}
