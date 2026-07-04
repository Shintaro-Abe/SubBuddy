import { describe, expect, it, vi } from "vitest";
import {
  authenticateDeviceSyncToken,
  extractBearerToken,
  hashDeviceSyncToken,
  verifyStaticBearerToken,
} from "@/lib/auth";

describe("auth boundary", () => {
  it("Bearer token を取り出す", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("Basic abc123")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it("static bearer token を timing-safe に検証する", () => {
    expect(verifyStaticBearerToken("Bearer expected", "expected")).toBe(true);
    expect(verifyStaticBearerToken("Bearer wrong", "expected")).toBe(false);
    expect(verifyStaticBearerToken(null, "expected")).toBe(false);
    expect(verifyStaticBearerToken("Bearer expected", "")).toBe(false);
  });

  it("device sync token は sha256 hash にする", () => {
    expect(hashDeviceSyncToken("device-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDeviceSyncToken("device-token")).toBe(hashDeviceSyncToken("device-token"));
  });

  it("有効な device token を AuthenticatedActor に正規化する", async () => {
    const token = "device-token";
    const db = {
      device: {
        findUnique: vi.fn().mockResolvedValue({ id: "dev_1", userId: "user_1", revokedAt: null }),
      },
    };

    const actor = await authenticateDeviceSyncToken(`Bearer ${token}`, db as never);

    expect(db.device.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashDeviceSyncToken(token) },
      select: { id: true, userId: true, revokedAt: true },
    });
    expect(actor).toEqual({
      kind: "device",
      userId: "user_1",
      deviceId: "dev_1",
      authProvider: "device_token",
    });
  });

  it("失効済み device token は拒否する", async () => {
    const db = {
      device: {
        findUnique: vi.fn().mockResolvedValue({ id: "dev_1", userId: "user_1", revokedAt: new Date() }),
      },
    };

    await expect(authenticateDeviceSyncToken("Bearer token", db as never)).resolves.toBeNull();
  });
});
