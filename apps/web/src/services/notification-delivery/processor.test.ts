import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  creationFindMany: vi.fn(),
  creationUpdateMany: vi.fn(),
  creationUpdate: vi.fn(),
  creationDeleteMany: vi.fn(),
  deliveryFindMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  deliveryUpdate: vi.fn(),
  deliveryDeleteMany: vi.fn(),
  noticeDeleteMany: vi.fn(),
  deviceUpdateMany: vi.fn(),
  sendApns: vi.fn(),
  createNotificationEvent: vi.fn(),
}));

vi.mock("@/config/notifications", () => ({
  notificationPolicy: {
    deliveryBatchSize: 50,
    deliveryLeaseSeconds: 300,
    maxDeliveryAttempts: 6,
    deliveryRetentionDays: 30,
    quietStartHour: 20,
    quietEndHour: 9,
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
    notificationCreationTask: {
      findMany: mocks.creationFindMany,
      updateMany: mocks.creationUpdateMany,
      update: mocks.creationUpdate,
      deleteMany: mocks.creationDeleteMany,
    },
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
vi.mock("@/services/notifications", () => ({
  createNotificationEvent: mocks.createNotificationEvent,
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
      timeZone: "Asia/Tokyo" as string | null,
    },
  };
}

function creationTask(attemptCount = 1) {
  return {
    id: "synthetic-creation",
    userId: "synthetic-user",
    kind: "new_sign_in",
    idempotencyKey: "new-sign-in:synthetic-session",
    templateKey: "new_sign_in",
    safeArguments: { clientType: "Webブラウザ" },
    excludeDeviceId: null,
    eventAt: NOW,
    status: "processing",
    attemptCount,
    nextAttemptAt: NOW,
    leaseExpiresAt: new Date("2026-07-23T12:05:00.000Z"),
    errorClass: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
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
    mocks.creationFindMany.mockResolvedValue([]);
    mocks.creationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.creationUpdate.mockResolvedValue({});
    mocks.creationDeleteMany.mockResolvedValue({ count: 0 });
    mocks.deliveryFindMany.mockResolvedValue([]);
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
      created: 0,
      creationFailed: 0,
      processed: 0,
      sent: 0,
      deferred: 0,
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

  it("削除予定通知は端末現地の20時以降なら次の9時へ繰り下げる", async () => {
    const delivery = apnsDelivery();
    delivery.event.kind = "account_deletion_scheduled";
    const localTwenty = new Date("2026-07-23T11:00:00.000Z");
    mocks.deliveryFindMany
      .mockResolvedValueOnce([{ id: "synthetic-delivery" }])
      .mockResolvedValueOnce([delivery]);

    const result = await processNotificationDeliveries(localTwenty);

    expect(result.deferred).toBe(1);
    expect(mocks.sendApns).not.toHaveBeenCalled();
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "synthetic-delivery" },
      data: {
        status: "pending",
        nextAttemptAt: new Date("2026-07-24T00:00:00.000Z"),
        leaseExpiresAt: null,
        errorClass: "outside_delivery_hours",
        attemptCount: { decrement: 1 },
      },
    });
  });

  it("新規サインインは端末現地の時間外でも即時配信する", async () => {
    const localTwenty = new Date("2026-07-23T11:00:00.000Z");
    mocks.deliveryFindMany
      .mockResolvedValueOnce([{ id: "synthetic-delivery" }])
      .mockResolvedValueOnce([apnsDelivery()]);
    mocks.sendApns.mockResolvedValue({
      status: "sent",
      providerMessageId: "synthetic-provider-id",
    });

    const result = await processNotificationDeliveries(localTwenty);

    expect(result.sent).toBe(1);
    expect(mocks.sendApns).toHaveBeenCalledTimes(1);
  });

  it("タイムゾーン未登録の削除予定通知は送らず再確認へ戻す", async () => {
    const delivery = apnsDelivery();
    delivery.event.kind = "account_deletion_scheduled";
    delivery.device.timeZone = null;
    mocks.deliveryFindMany
      .mockResolvedValueOnce([{ id: "synthetic-delivery" }])
      .mockResolvedValueOnce([delivery]);

    const result = await processNotificationDeliveries(NOW);

    expect(result.deferred).toBe(1);
    expect(mocks.sendApns).not.toHaveBeenCalled();
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "synthetic-delivery" },
      data: expect.objectContaining({
        status: "pending",
        nextAttemptAt: new Date("2026-07-23T18:00:00.000Z"),
        errorClass: "device_time_zone_unavailable",
        attemptCount: { decrement: 1 },
      }),
    });
  });

  it("通知作成待ちをイベント・お知らせ・配信待ちへ冪等に展開する", async () => {
    mocks.creationFindMany
      .mockResolvedValueOnce([{ id: "synthetic-creation" }])
      .mockResolvedValueOnce([creationTask()]);
    mocks.createNotificationEvent.mockResolvedValue({ id: "synthetic-event" });

    const result = await processNotificationDeliveries(NOW);

    expect(result.created).toBe(1);
    expect(mocks.createNotificationEvent).toHaveBeenCalledWith({
      userId: "synthetic-user",
      kind: "new_sign_in",
      idempotencyKey: "new-sign-in:synthetic-session",
      templateKey: "new_sign_in",
      safeArguments: { clientType: "Webブラウザ" },
      excludeDeviceId: undefined,
      eventAt: NOW,
    });
    expect(mocks.creationUpdate).toHaveBeenCalledWith({
      where: { id: "synthetic-creation" },
      data: {
        status: "completed",
        completedAt: NOW,
        leaseExpiresAt: null,
        errorClass: null,
      },
    });
  });

  it("通知作成失敗は安全な分類だけを残して再試行する", async () => {
    mocks.creationFindMany
      .mockResolvedValueOnce([{ id: "synthetic-creation" }])
      .mockResolvedValueOnce([creationTask(1)]);
    mocks.createNotificationEvent.mockRejectedValue(new Error("synthetic failure"));

    const result = await processNotificationDeliveries(NOW);

    expect(result.creationFailed).toBe(1);
    expect(mocks.creationUpdate).toHaveBeenCalledWith({
      where: { id: "synthetic-creation" },
      data: {
        status: "retryable_failure",
        nextAttemptAt: new Date("2026-07-23T12:00:30.000Z"),
        leaseExpiresAt: null,
        errorClass: "event_creation_failed",
      },
    });
  });
});
