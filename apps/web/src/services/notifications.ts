import type { Prisma, PushEnvironment } from "@prisma/client";
import { notificationPolicy, parseNotificationConfig } from "@/config/notifications";
import { encryptNotificationValue, notificationFingerprint } from "@/lib/notification-crypto";
import { prisma } from "@/lib/prisma";
import type {
  AccountDeletionCheckpoint,
  AccountDeletionReason,
} from "@/domain/notifications/deletion";

export const defaultNotificationPreferences = {
  yearlyRenewalEnabled: false,
  monthlyRenewalEnabled: false,
  syncFailureEnabled: false,
  newSignInPushEnabled: true,
  promptDismissedAt: null as Date | null,
};

type PreferencePatch = Partial<{
  yearlyRenewalEnabled: boolean;
  monthlyRenewalEnabled: boolean;
  syncFailureEnabled: boolean;
  newSignInPushEnabled: boolean;
  promptDismissed: boolean;
}>;

export async function getNotificationPreferences(userId: string) {
  const saved = await prisma.notificationPreference.findUnique({ where: { userId } });
  return saved ?? { userId, ...defaultNotificationPreferences };
}

export async function updateNotificationPreferences(userId: string, patch: PreferencePatch) {
  const promptDismissedAt =
    patch.promptDismissed === undefined ? undefined : patch.promptDismissed ? new Date() : null;
  const data = {
    ...(patch.yearlyRenewalEnabled !== undefined && {
      yearlyRenewalEnabled: patch.yearlyRenewalEnabled,
    }),
    ...(patch.monthlyRenewalEnabled !== undefined && {
      monthlyRenewalEnabled: patch.monthlyRenewalEnabled,
    }),
    ...(patch.syncFailureEnabled !== undefined && {
      syncFailureEnabled: patch.syncFailureEnabled,
    }),
    ...(patch.newSignInPushEnabled !== undefined && {
      newSignInPushEnabled: patch.newSignInPushEnabled,
    }),
    ...(promptDismissedAt !== undefined && { promptDismissedAt }),
  };
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...defaultNotificationPreferences, ...data },
    update: data,
  });
}

export async function listNotificationNotices(userId: string, now = new Date()) {
  return prisma.notificationNotice.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: { gt: now } },
        { resolvedAt: null, kind: { in: ["account_deletion_scheduled", "safety_incident"] } },
      ],
    },
    orderBy: { eventAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      templateKey: true,
      safeArguments: true,
      eventAt: true,
      readAt: true,
      expiresAt: true,
      resolvedAt: true,
    },
  });
}

export async function markNotificationNoticeRead(
  userId: string,
  noticeId: string,
  now = new Date(),
) {
  const result = await prisma.notificationNotice.updateMany({
    where: { id: noticeId, userId, readAt: null },
    data: { readAt: now },
  });
  if (result.count === 1) return true;
  return (await prisma.notificationNotice.count({ where: { id: noticeId, userId } })) === 1;
}

export async function registerPushToken(
  userId: string,
  deviceId: string,
  token: string,
  environment: PushEnvironment,
  deliveryEnabled: boolean,
  timeZone?: string,
) {
  const config = parseNotificationConfig();
  if (!config.enabled) throw new Error("notifications disabled");
  if (environment !== config.apns.environment) {
    throw new PushEnvironmentMismatchError();
  }
  const normalized = token.toLowerCase();
  const encrypted = encryptNotificationValue(normalized, config);
  const fingerprint = notificationFingerprint(normalized, config.fingerprintKey);
  const updatedAt = new Date();
  const result = await prisma.device.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: {
      pushTokenCiphertext: encrypted.ciphertext,
      pushTokenFingerprint: fingerprint,
      pushTokenKeyVersion: encrypted.keyVersion,
      pushEnvironment: environment,
      notificationDeliveryEnabled: deliveryEnabled,
      pushTokenUpdatedAt: updatedAt,
      ...(timeZone && { timeZone }),
    },
  });
  if (result.count === 1 && timeZone) {
    await prisma.notificationDelivery.updateMany({
      where: {
        deviceId,
        status: { in: ["pending", "retryable_failure"] },
        event: { kind: "account_deletion_scheduled" },
      },
      data: { nextAttemptAt: updatedAt },
    });
  }
  return result.count === 1;
}

export async function releaseNewSignInNotificationTask(
  userId: string,
  sessionId: string,
  excludeDeviceId: string,
  now = new Date(),
) {
  const result = await prisma.notificationCreationTask.updateMany({
    where: {
      userId,
      idempotencyKey: `new-sign-in:${sessionId}`,
      status: { in: ["pending", "retryable_failure"] },
    },
    data: {
      excludeDeviceId,
      nextAttemptAt: now,
    },
  });
  return result.count === 1;
}

export async function clearPushToken(userId: string, deviceId: string) {
  const result = await prisma.device.updateMany({
    where: { id: deviceId, userId },
    data: {
      pushTokenCiphertext: null,
      pushTokenFingerprint: null,
      pushTokenKeyVersion: null,
      pushEnvironment: null,
      notificationDeliveryEnabled: false,
      pushTokenUpdatedAt: null,
    },
  });
  return result.count === 1;
}

export async function createNotificationEvent(input: {
  userId: string;
  kind: "new_sign_in" | "account_deletion_scheduled" | "safety_incident";
  idempotencyKey: string;
  templateKey: string;
  safeArguments?: Prisma.InputJsonValue;
  excludeDeviceId?: string;
  eventAt?: Date;
}) {
  const eventAt = input.eventAt ?? new Date();
  const expiresAt = new Date(
    eventAt.getTime() + notificationPolicy.noticeRetentionDays * 24 * 60 * 60 * 1000,
  );
  return prisma.$transaction(async (tx) => {
    const event = await tx.notificationEvent.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        userId: input.userId,
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        templateKey: input.templateKey,
        safeArguments: input.safeArguments,
      },
      update: {},
    });
    if (
      event.userId !== input.userId ||
      event.kind !== input.kind ||
      event.templateKey !== input.templateKey
    ) {
      throw new Error("notification idempotency key collision");
    }
    await tx.notificationNotice.upsert({
      where: { eventId: event.id },
      create: {
        userId: input.userId,
        eventId: event.id,
        kind: input.kind,
        templateKey: input.templateKey,
        safeArguments: input.safeArguments,
        eventAt,
        expiresAt,
      },
      update: {},
    });

    const preferences = await tx.notificationPreference.findUnique({
      where: { userId: input.userId },
    });
    const devices =
      input.kind === "new_sign_in" && preferences?.newSignInPushEnabled === false
        ? []
        : await tx.device.findMany({
            where: {
              userId: input.userId,
              revokedAt: null,
              notificationDeliveryEnabled: true,
              pushTokenCiphertext: { not: null },
              ...(input.excludeDeviceId && { id: { not: input.excludeDeviceId } }),
            },
            select: { id: true },
          });
    if (devices.length > 0) {
      await tx.notificationDelivery.createMany({
        data: devices.map((device) => ({
          userId: input.userId,
          eventId: event.id,
          channel: "apns" as const,
          targetKey: `device:${device.id}`,
          deviceId: device.id,
        })),
        skipDuplicates: true,
      });
    }

    return event;
  });
}

export class PushEnvironmentMismatchError extends Error {
  constructor() {
    super("push environment does not match server");
    this.name = "PushEnvironmentMismatchError";
  }
}

export async function recordAccountDeletionScheduled(input: {
  userId: string;
  scheduleId: string;
  checkpoint: AccountDeletionCheckpoint;
  reason: Exclude<AccountDeletionReason, "immediate_reauthentication">;
  eventAt?: Date;
}) {
  const config = parseNotificationConfig();
  if (!config.enabled) return null;
  return createNotificationEvent({
    userId: input.userId,
    kind: "account_deletion_scheduled",
    idempotencyKey: `account-deletion:${input.scheduleId}:${input.checkpoint}`,
    templateKey: "account_deletion_scheduled",
    safeArguments: {
      reason: input.reason,
      checkpoint: input.checkpoint,
    },
    eventAt: input.eventAt,
  });
}

export async function resolveAccountDeletionSchedule(
  userId: string,
  scheduleId: string,
  now = new Date(),
) {
  await prisma.$transaction(async (tx) => {
    const events = await tx.notificationEvent.findMany({
      where: {
        userId,
        kind: "account_deletion_scheduled",
        idempotencyKey: { startsWith: `account-deletion:${scheduleId}:` },
      },
      select: { id: true },
    });
    const eventIds = events.map((event) => event.id);
    if (eventIds.length === 0) return;
    await tx.notificationNotice.updateMany({
      where: { userId, eventId: { in: eventIds }, resolvedAt: null },
      data: { resolvedAt: now },
    });
    await tx.notificationDelivery.updateMany({
      where: {
        userId,
        eventId: { in: eventIds },
        status: { in: ["pending", "retryable_failure"] },
      },
      data: { status: "canceled", leaseExpiresAt: null },
    });
  });
}
