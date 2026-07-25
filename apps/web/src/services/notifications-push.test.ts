import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deviceUpdateMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  creationUpdateMany: vi.fn(),
  encrypt: vi.fn(),
  fingerprint: vi.fn(),
}));

vi.mock("@/config/notifications", () => ({
  notificationPolicy: {},
  parseNotificationConfig: () => ({
    enabled: true,
    apns: { environment: "sandbox" },
    activeKeyVersion: 1,
    fingerprintKey: new Uint8Array(32),
  }),
}));
vi.mock("@/lib/notification-crypto", () => ({
  decryptNotificationValue: vi.fn(),
  encryptNotificationValue: mocks.encrypt,
  notificationFingerprint: mocks.fingerprint,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    device: { updateMany: mocks.deviceUpdateMany },
    notificationDelivery: { updateMany: mocks.deliveryUpdateMany },
    notificationCreationTask: { updateMany: mocks.creationUpdateMany },
  },
}));

import {
  PushEnvironmentMismatchError,
  registerPushToken,
  releaseNewSignInNotificationTask,
} from "./notifications";

describe("APNsトークン登録", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.encrypt.mockReturnValue({ ciphertext: "synthetic-ciphertext", keyVersion: 1 });
    mocks.fingerprint.mockReturnValue("synthetic-fingerprint");
    mocks.deviceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 });
    mocks.creationUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("サーバーと異なるAPNs環境は保存前に拒否する", async () => {
    await expect(
      registerPushToken(
        "synthetic-user",
        "synthetic-device",
        "AABBCCDDEEFF00112233445566778899",
        "production",
        true,
        "Asia/Tokyo",
      ),
    ).rejects.toBeInstanceOf(PushEnvironmentMismatchError);
    expect(mocks.encrypt).not.toHaveBeenCalled();
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled();
  });

  it("一致する環境では小文字へ正規化して暗号化保存する", async () => {
    await expect(
      registerPushToken(
        "synthetic-user",
        "synthetic-device",
        "AABBCCDDEEFF00112233445566778899",
        "sandbox",
        true,
        "Asia/Tokyo",
      ),
    ).resolves.toBe(true);
    expect(mocks.encrypt).toHaveBeenCalledWith(
      "aabbccddeeff00112233445566778899",
      expect.objectContaining({ enabled: true }),
    );
    expect(mocks.deviceUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "synthetic-device",
        userId: "synthetic-user",
        revokedAt: null,
      },
      data: expect.objectContaining({
        pushEnvironment: "sandbox",
        notificationDeliveryEnabled: true,
        timeZone: "Asia/Tokyo",
      }),
    });
    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith({
      where: {
        deviceId: "synthetic-device",
        status: { in: ["pending", "retryable_failure"] },
        event: { kind: "account_deletion_scheduled" },
      },
      data: { nextAttemptAt: expect.any(Date) },
    });
  });

  it("iPhone登録後は通知作成待ちへ除外端末と即時実行時刻を保存する", async () => {
    const now = new Date("2026-07-25T01:00:00.000Z");

    await expect(
      releaseNewSignInNotificationTask(
        "synthetic-user",
        "synthetic-session",
        "synthetic-device",
        now,
      ),
    ).resolves.toBe(true);

    expect(mocks.creationUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "synthetic-user",
        idempotencyKey: "new-sign-in:synthetic-session",
        status: { in: ["pending", "retryable_failure"] },
      },
      data: {
        excludeDeviceId: "synthetic-device",
        nextAttemptAt: now,
      },
    });
  });
});
