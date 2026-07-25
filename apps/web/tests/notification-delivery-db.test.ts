import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendApns: vi.fn(),
}));

vi.mock("@/config/notifications", () => ({
  notificationPolicy: {
    deliveryBatchSize: 50,
    deliveryLeaseSeconds: 300,
    maxDeliveryAttempts: 6,
    deliveryRetentionDays: 30,
  },
  parseNotificationConfig: () => ({
    enabled: true,
    apns: { environment: "sandbox" },
  }),
}));
vi.mock("@/lib/notification-crypto", () => ({
  decryptNotificationValue: () => "synthetic-device-token",
}));
vi.mock("@/services/notification-delivery/apns", () => ({
  sendApnsNotification: mocks.sendApns,
}));
import { prisma } from "@/lib/prisma";
import { processNotificationDeliveries } from "@/services/notification-delivery/processor";

const runDbTests = process.env.NOTIFICATION_DB_INTEGRATION === "1";
const describeDb = runDbTests ? describe : describe.skip;

describeDb("通知配信キューのDB結合", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.user.deleteMany({ where: { id: { startsWith: "synthetic-notification-db-" } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { startsWith: "synthetic-notification-db-" } } });
    await prisma.$disconnect();
  });

  it("並列処理でも同じ配信を1回だけ送る", async () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const userId = "synthetic-notification-db-user";
    const deviceId = "synthetic-notification-db-device";
    const eventId = "synthetic-notification-db-event";
    const deliveryId = "synthetic-notification-db-delivery";
    await prisma.user.create({ data: { id: userId, name: "Synthetic User" } });
    await prisma.device.create({
      data: {
        id: deviceId,
        userId,
        name: "Synthetic iPhone",
        tokenHash: "synthetic-notification-db-token-hash",
        pushTokenCiphertext: "synthetic-ciphertext",
        pushTokenFingerprint: "synthetic-notification-db-fingerprint",
        pushTokenKeyVersion: 1,
        pushEnvironment: "sandbox",
        notificationDeliveryEnabled: true,
        pushTokenUpdatedAt: now,
      },
    });
    await prisma.notificationEvent.create({
      data: {
        id: eventId,
        userId,
        kind: "new_sign_in",
        idempotencyKey: "synthetic-notification-db-event-key",
        templateKey: "new_sign_in",
      },
    });
    await prisma.notificationDelivery.create({
      data: {
        id: deliveryId,
        userId,
        eventId,
        channel: "apns",
        targetKey: `device:${deviceId}`,
        deviceId,
        nextAttemptAt: now,
      },
    });
    mocks.sendApns.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { status: "sent", providerMessageId: "synthetic-provider-id" };
    });

    const [first, second] = await Promise.all([
      processNotificationDeliveries(now),
      processNotificationDeliveries(now),
    ]);

    expect(first.processed + second.processed).toBe(1);
    expect(mocks.sendApns).toHaveBeenCalledTimes(1);
    await expect(
      prisma.notificationDelivery.findUnique({
        where: { id: deliveryId },
        select: { status: true, attemptCount: true, providerMessageId: true },
      }),
    ).resolves.toEqual({
      status: "sent",
      attemptCount: 1,
      providerMessageId: "synthetic-provider-id",
    });
  });
});
