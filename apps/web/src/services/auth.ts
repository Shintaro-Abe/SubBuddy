import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashDeviceSyncToken, type AuthenticatedActor } from "@/lib/auth";
import type { AppleIdentity } from "@/lib/apple-auth";

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
