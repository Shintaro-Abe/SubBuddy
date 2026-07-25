import type { NotificationDeliveryStatus } from "@prisma/client";
import { notificationPolicy, parseNotificationConfig } from "@/config/notifications";
import { templateFor } from "@/domain/notifications/templates";
import { decryptNotificationValue } from "@/lib/notification-crypto";
import { prisma } from "@/lib/prisma";
import { sendApnsNotification, type DeliveryResult } from "./apns";

type ClaimedDelivery = Awaited<ReturnType<typeof claimDeliveries>>[number];

function retryDelaySeconds(attempt: number): number {
  return Math.min(6 * 60 * 60, 30 * 2 ** Math.max(0, attempt - 1));
}

async function claimDeliveries(now: Date) {
  const candidates = await prisma.notificationDelivery.findMany({
    where: {
      OR: [
        {
          status: { in: ["pending", "retryable_failure"] },
          nextAttemptAt: { lte: now },
        },
        {
          status: "processing",
          leaseExpiresAt: { lte: now },
        },
      ],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: notificationPolicy.deliveryBatchSize,
    select: { id: true },
  });
  const claimed: string[] = [];
  const leaseExpiresAt = new Date(now.getTime() + notificationPolicy.deliveryLeaseSeconds * 1000);
  for (const candidate of candidates) {
    const result = await prisma.notificationDelivery.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: { in: ["pending", "retryable_failure"] }, nextAttemptAt: { lte: now } },
          { status: "processing", leaseExpiresAt: { lte: now } },
        ],
      },
      data: { status: "processing", leaseExpiresAt, attemptCount: { increment: 1 } },
    });
    if (result.count === 1) claimed.push(candidate.id);
  }
  return prisma.notificationDelivery.findMany({
    where: { id: { in: claimed } },
    include: { event: true, device: true },
  });
}

async function deliver(item: ClaimedDelivery): Promise<DeliveryResult> {
  const config = parseNotificationConfig();
  if (!config.enabled) return { status: "retry", errorClass: "notifications_disabled" };
  const template = templateFor(item.event.kind);
  if (item.channel === "apns" && item.device?.pushTokenCiphertext) {
    if (item.device.pushEnvironment !== config.apns.environment) {
      return { status: "permanent", errorClass: "apns_environment_mismatch" };
    }
    return sendApnsNotification({
      config,
      deviceToken: decryptNotificationValue(item.device.pushTokenCiphertext, config),
      title: template.title,
      body: template.body,
      eventId: item.event.id,
      route: item.event.kind === "new_sign_in" ? "sessions" : "notices",
    });
  }
  return { status: "permanent", errorClass: "delivery_target_unavailable" };
}

async function finishDelivery(item: ClaimedDelivery, result: DeliveryResult, now: Date) {
  let status: NotificationDeliveryStatus;
  if (result.status === "sent") status = "sent";
  else if (
    result.status === "retry" &&
    item.attemptCount < notificationPolicy.maxDeliveryAttempts
  ) {
    status = "retryable_failure";
  } else {
    status = "permanent_failure";
  }

  const nextAttemptAt =
    status === "retryable_failure"
      ? new Date(
          now.getTime() +
            (result.status === "retry" && result.retryAfterSeconds
              ? result.retryAfterSeconds
              : retryDelaySeconds(item.attemptCount)) *
              1000,
        )
      : now;

  await prisma.$transaction(async (tx) => {
    await tx.notificationDelivery.update({
      where: { id: item.id },
      data: {
        status,
        nextAttemptAt,
        leaseExpiresAt: null,
        errorClass: result.status === "sent" ? null : result.errorClass,
        providerMessageId: result.status === "sent" ? result.providerMessageId : null,
        sentAt: result.status === "sent" ? now : null,
      },
    });
    if (status === "permanent_failure" && result.status !== "sent") {
      if (
        ["invalid_device_token", "apns_environment_mismatch"].includes(result.errorClass) &&
        item.deviceId
      ) {
        await tx.device.updateMany({
          where: { id: item.deviceId },
          data: {
            pushTokenCiphertext: null,
            pushTokenFingerprint: null,
            pushTokenKeyVersion: null,
            pushEnvironment: null,
            notificationDeliveryEnabled: false,
            pushTokenUpdatedAt: null,
          },
        });
      }
    }
  });
}

export async function processNotificationDeliveries(now = new Date()) {
  const config = parseNotificationConfig();
  if (!config.enabled) return { processed: 0, sent: 0, failed: 0, disabled: true };
  const items = await claimDeliveries(now);
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    const result = await deliver(item);
    await finishDelivery(item, result, now);
    if (result.status === "sent") sent += 1;
    else failed += 1;
  }
  await prisma.$transaction([
    prisma.notificationDelivery.deleteMany({
      where: {
        updatedAt: {
          lt: new Date(
            now.getTime() - notificationPolicy.deliveryRetentionDays * 24 * 60 * 60 * 1000,
          ),
        },
        status: { in: ["sent", "permanent_failure", "canceled"] },
      },
    }),
    prisma.notificationNotice.deleteMany({
      where: {
        expiresAt: { lte: now },
        OR: [
          { kind: { notIn: ["account_deletion_scheduled", "safety_incident"] } },
          { resolvedAt: { not: null } },
        ],
      },
    }),
  ]);
  return { processed: items.length, sent, failed, disabled: false };
}
