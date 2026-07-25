import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deviceUpdateMany: vi.fn(),
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
  },
}));

import { PushEnvironmentMismatchError, registerPushToken } from "./notifications";

describe("APNsトークン登録", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.encrypt.mockReturnValue({ ciphertext: "synthetic-ciphertext", keyVersion: 1 });
    mocks.fingerprint.mockReturnValue("synthetic-fingerprint");
    mocks.deviceUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("サーバーと異なるAPNs環境は保存前に拒否する", async () => {
    await expect(
      registerPushToken(
        "synthetic-user",
        "synthetic-device",
        "AABBCCDDEEFF00112233445566778899",
        "production",
        true,
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
      }),
    });
  });
});
