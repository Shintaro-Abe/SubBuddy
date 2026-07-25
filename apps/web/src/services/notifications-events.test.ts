import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  eventUpsert: vi.fn(),
  eventFindMany: vi.fn(),
  noticeUpsert: vi.fn(),
  noticeUpdateMany: vi.fn(),
  preferenceFindUnique: vi.fn(),
  deviceFindMany: vi.fn(),
  deliveryCreateMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
}));

vi.mock("@/config/notifications", () => ({
  notificationPolicy: {
    noticeRetentionDays: 90,
  },
  parseNotificationConfig: () => ({ enabled: true }),
}));
vi.mock("@/lib/notification-crypto", () => ({
  decryptNotificationValue: vi.fn(),
  encryptNotificationValue: vi.fn(),
  notificationFingerprint: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import {
  createNotificationEvent,
  recordAccountDeletionScheduled,
  resolveAccountDeletionSchedule,
} from "./notifications";

const NOW = new Date("2026-07-23T12:00:00.000Z");

describe("通知イベント作成", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      notificationEvent: { upsert: mocks.eventUpsert, findMany: mocks.eventFindMany },
      notificationNotice: {
        upsert: mocks.noticeUpsert,
        updateMany: mocks.noticeUpdateMany,
      },
      notificationPreference: { findUnique: mocks.preferenceFindUnique },
      device: { findMany: mocks.deviceFindMany },
      notificationDelivery: {
        createMany: mocks.deliveryCreateMany,
        updateMany: mocks.deliveryUpdateMany,
      },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    mocks.eventUpsert.mockResolvedValue({
      id: "synthetic-event",
      userId: "synthetic-user",
      kind: "new_sign_in",
      idempotencyKey: "synthetic-key",
      templateKey: "new_sign_in",
    });
    mocks.noticeUpsert.mockResolvedValue({ id: "synthetic-notice" });
    mocks.preferenceFindUnique.mockResolvedValue({ newSignInPushEnabled: true });
    mocks.deviceFindMany.mockResolvedValue([{ id: "synthetic-device" }]);
    mocks.deliveryCreateMany.mockResolvedValue({ count: 1 });
    mocks.noticeUpdateMany.mockResolvedValue({ count: 0 });
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("同じキーを再実行してもupsertと重複無視で同じイベントへ収束する", async () => {
    const input = {
      userId: "synthetic-user",
      kind: "new_sign_in" as const,
      idempotencyKey: "synthetic-key",
      templateKey: "new_sign_in",
      eventAt: NOW,
    };

    await Promise.all([createNotificationEvent(input), createNotificationEvent(input)]);

    expect(mocks.eventUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.noticeUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.deliveryCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it("同じキーが別利用者や別種別を指す場合は処理を止める", async () => {
    mocks.eventUpsert.mockResolvedValue({
      id: "synthetic-event",
      userId: "another-synthetic-user",
      kind: "safety_incident",
      idempotencyKey: "synthetic-key",
      templateKey: "safety_incident",
    });

    await expect(
      createNotificationEvent({
        userId: "synthetic-user",
        kind: "new_sign_in",
        idempotencyKey: "synthetic-key",
        templateKey: "new_sign_in",
      }),
    ).rejects.toThrow("notification idempotency key collision");
    expect(mocks.noticeUpsert).not.toHaveBeenCalled();
  });

  it("削除予定は全有効端末を重複なく配信待ちへ入れる", async () => {
    mocks.eventUpsert.mockResolvedValue({
      id: "synthetic-deletion-event",
      userId: "synthetic-user",
      kind: "account_deletion_scheduled",
      idempotencyKey: "account-deletion:synthetic-schedule:7_days",
      templateKey: "account_deletion_scheduled",
    });
    mocks.deviceFindMany.mockResolvedValue([
      { id: "synthetic-device-a" },
      { id: "synthetic-device-b" },
    ]);

    await recordAccountDeletionScheduled({
      userId: "synthetic-user",
      scheduleId: "synthetic-schedule",
      checkpoint: "7_days",
      reason: "inactive_account",
      eventAt: NOW,
    });

    expect(mocks.deliveryCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ targetKey: "device:synthetic-device-a", channel: "apns" }),
        expect.objectContaining({ targetKey: "device:synthetic-device-b", channel: "apns" }),
      ],
      skipDuplicates: true,
    });
  });

  it("削除予定の取消は未送信だけを止め、お知らせを解決済みにする", async () => {
    mocks.eventFindMany.mockResolvedValue([
      { id: "synthetic-deletion-event-a" },
      { id: "synthetic-deletion-event-b" },
    ]);
    const resolvedAt = new Date("2026-07-23T13:00:00.000Z");

    await resolveAccountDeletionSchedule("synthetic-user", "synthetic-schedule", resolvedAt);

    expect(mocks.eventFindMany).toHaveBeenCalledWith({
      where: {
        userId: "synthetic-user",
        kind: "account_deletion_scheduled",
        idempotencyKey: { startsWith: "account-deletion:synthetic-schedule:" },
      },
      select: { id: true },
    });
    expect(mocks.noticeUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "synthetic-user",
        eventId: {
          in: ["synthetic-deletion-event-a", "synthetic-deletion-event-b"],
        },
        resolvedAt: null,
      },
      data: { resolvedAt },
    });
    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "synthetic-user",
        eventId: {
          in: ["synthetic-deletion-event-a", "synthetic-deletion-event-b"],
        },
        status: { in: ["pending", "retryable_failure"] },
      },
      data: { status: "canceled", leaseExpiresAt: null },
    });
  });
});
