import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  deliveryFindMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  deliveryUpdate: vi.fn(),
  deliveryDeleteMany: vi.fn(),
  noticeDeleteMany: vi.fn(),
  deviceUpdateMany: vi.fn(),
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
  decryptNotificationValue: () => "synthetic-decrypted-value",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationDelivery: {
      findMany: mocks.deliveryFindMany,
      updateMany: mocks.deliveryUpdateMany,
      update: mocks.deliveryUpdate,
      deleteMany: mocks.deliveryDeleteMany,
    },
    notificationNotice: { deleteMany: mocks.noticeDeleteMany },
    device: { updateMany: mocks.deviceUpdateMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./apns", () => ({
  sendApnsNotification: mocks.sendApns,
}));
import { processNotificationDeliveries } from "./processor";

const NOW = new Date("2026-07-23T12:00:00.000Z");

function apnsDelivery(attemptCount = 1) {
  return {
    id: "synthetic-delivery",
    userId: "synthetic-user",
    eventId: "synthetic-event",
    channel: "apns",
    targetKey: "device:synthetic-device",
    deviceId: "synthetic-device",
    status: "processing",
    attemptCount,
    nextAttemptAt: NOW,
    leaseExpiresAt: new Date("2026-07-23T12:05:00.000Z"),
    errorClass: null,
    providerMessageId: null,
    sentAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    event: {
      id: "synthetic-event",
      kind: "new_sign_in",
    },
    device: {
      id: "synthetic-device",
      pushTokenCiphertext: "synthetic-ciphertext",
      pushEnvironment: "sandbox",
    },
  };
}

describe("通知配信処理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      notificationDelivery: { update: mocks.deliveryUpdate },
      device: { updateMany: mocks.deviceUpdateMany },
    };
    mocks.transaction.mockImplementation(
      (operation: Promise<unknown>[] | ((client: typeof tx) => Promise<unknown>)) =>
        Array.isArray(operation) ? Promise.all(operation) : operation(tx),
    );
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryUpdate.mockResolvedValue({});
    mocks.deliveryDeleteMany.mockResolvedValue({ count: 0 });
    mocks.noticeDeleteMany.mockResolvedValue({ count: 0 });
    mocks.deviceUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("別処理が先に取得した配信は送らない", async () => {
    mocks.deliveryFindMany.mockResolvedValueOnce([{ id: "synthetic-delivery" }]);
    mocks.deliveryUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.deliveryFindMany.mockResolvedValueOnce([]);

    await expect(processNotificationDeliveries(NOW)).resolves.toEqual({
      processed: 0,
      sent: 0,
      failed: 0,
      disabled: false,
    });
    expect(mocks.sendApns).not.toHaveBeenCalled();
  });

  it("一時失敗は上限前なら時刻を進めて再試行へ戻す", async () => {
    mocks.deliveryFindMany
      .mockResolvedValueOnce([{ id: "synthetic-delivery" }])
      .mockResolvedValueOnce([apnsDelivery(1)]);
    mocks.sendApns.mockResolvedValue({
      status: "retry",
      errorClass: "apns_temporary",
      retryAfterSeconds: 120,
    });

    await processNotificationDeliveries(NOW);

    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "synthetic-delivery" },
      data: expect.objectContaining({
        status: "retryable_failure",
        nextAttemptAt: new Date("2026-07-23T12:02:00.000Z"),
        errorClass: "apns_temporary",
        leaseExpiresAt: null,
      }),
    });
  });

  it("無効なAPNsトークンは恒久失敗にして端末から削除する", async () => {
    mocks.deliveryFindMany
      .mockResolvedValueOnce([{ id: "synthetic-delivery" }])
      .mockResolvedValueOnce([apnsDelivery()]);
    mocks.sendApns.mockResolvedValue({
      status: "permanent",
      errorClass: "invalid_device_token",
    });

    await processNotificationDeliveries(NOW);

    expect(mocks.deviceUpdateMany).toHaveBeenCalledWith({
      where: { id: "synthetic-device" },
      data: {
        pushTokenCiphertext: null,
        pushTokenFingerprint: null,
        pushTokenKeyVersion: null,
        pushEnvironment: null,
        notificationDeliveryEnabled: false,
        pushTokenUpdatedAt: null,
      },
    });
  });

  it("APNs環境が食い違う既存トークンも端末から削除する", async () => {
    const delivery = apnsDelivery();
    delivery.device.pushEnvironment = "production";
    mocks.deliveryFindMany
      .mockResolvedValueOnce([{ id: "synthetic-delivery" }])
      .mockResolvedValueOnce([delivery]);

    await processNotificationDeliveries(NOW);

    expect(mocks.sendApns).not.toHaveBeenCalled();
    expect(mocks.deviceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "synthetic-device" },
        data: expect.objectContaining({ notificationDeliveryEnabled: false }),
      }),
    );
  });
});
