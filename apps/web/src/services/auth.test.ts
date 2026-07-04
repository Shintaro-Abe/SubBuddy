import { describe, expect, it } from "vitest";
import { hashDeviceSyncToken } from "@/lib/auth";
import { registerDeviceForAppleUser, revokeDeviceForAppleUser, upsertAppleUser } from "@/services/auth";

function fakeDb() {
  const calls: { userUpsert?: unknown; deviceCreate?: unknown; deviceUpdateMany?: unknown } = {};
  const db = {
    user: {
      upsert: async (args: unknown) => {
        calls.userUpsert = args;
        return { id: "user_1" };
      },
    },
    device: {
      create: async (args: unknown) => {
        calls.deviceCreate = args;
        return { id: "device_1", name: "iPhone" };
      },
      updateMany: async (args: unknown) => {
        calls.deviceUpdateMany = args;
        return { count: 1 };
      },
    },
  };
  return { db, calls };
}

describe("auth service", () => {
  it("Apple subject hash でユーザーを upsert し AuthenticatedActor を返す", async () => {
    const { db, calls } = fakeDb();
    const actor = await upsertAppleUser({ subjectHash: "subject-hash" }, db as never);

    expect(actor).toEqual({ kind: "user", userId: "user_1", authProvider: "apple" });
    expect(calls.userUpsert).toMatchObject({
      where: { appleSubjectHash: "subject-hash" },
      create: { name: "Apple user", appleSubjectHash: "subject-hash" },
      select: { id: true },
    });
  });

  it("デバイス同期トークンを平文保存せず hash だけ保存する", async () => {
    const { db, calls } = fakeDb();
    const result = await registerDeviceForAppleUser(
      "user_1",
      "iPhone",
      db as never,
      () => "raw-device-token",
    );

    expect(result).toEqual({
      device: { id: "device_1", name: "iPhone" },
      deviceSyncToken: "raw-device-token",
    });
    expect(calls.deviceCreate).toEqual({
      data: {
        userId: "user_1",
        name: "iPhone",
        tokenHash: hashDeviceSyncToken("raw-device-token"),
      },
      select: { id: true, name: true },
    });
  });

  it("所有ユーザーと device id が一致する有効 device だけ失効する", async () => {
    const { db, calls } = fakeDb();
    await expect(revokeDeviceForAppleUser("user_1", "device_1", db as never)).resolves.toBe(true);

    expect(calls.deviceUpdateMany).toMatchObject({
      where: { id: "device_1", userId: "user_1", revokedAt: null },
    });
  });
});
