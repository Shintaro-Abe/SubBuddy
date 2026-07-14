import { describe, expect, it } from "vitest";
import { hashDeviceSyncToken } from "@/lib/auth";
import {
  createAuthSession,
  deleteAppleUserAccount,
  RefreshSessionError,
  registerDeviceForAppleUser,
  revokeDeviceForAppleUser,
  rotateAuthSession,
  upsertAppleUser,
} from "@/services/auth";
import type { CloudAuthConfig } from "@/config/auth";
import { hashRefreshToken, verifyAccessToken } from "@/lib/session-tokens";

const NOW = new Date("2026-07-14T00:00:00.000Z");
const authConfig: CloudAuthConfig = {
  mode: "cloud-testflight",
  databaseUrl: "postgresql://synthetic.invalid/synthetic",
  appleAllowedClientIds: ["com.subbuddy.web", "com.subbuddy.app"],
  appleSubjectHashSalt: "synthetic-subject-hash-salt-32-bytes",
  tokenIssuer: "https://testflight-api.subbuddy.example",
  tokenAudience: "subbuddy-cloud-testflight",
  jwtSecret: new TextEncoder().encode("synthetic-jwt-secret-for-tests-only"),
  accessTtlSeconds: 900,
  webSessionTtlSeconds: 86400,
  idleTtlSeconds: 2592000,
  absoluteTtlSeconds: 7776000,
  appleOutageGraceSeconds: 259200,
  accessCookieName: "__Host-subbuddy-testflight-access",
  refreshCookieName: "__Host-subbuddy-testflight-refresh",
  csrfCookieName: "__Host-subbuddy-testflight-csrf",
  allowedOrigins: ["https://testflight.subbuddy.example"],
};

function fakeDb() {
  const calls: {
    userUpsert?: unknown;
    userDeleteMany?: unknown;
    deviceCreate?: unknown;
    deviceUpsert?: unknown;
    deviceUpdateMany?: unknown;
  } = {};
  const db = {
    user: {
      upsert: async (args: unknown) => {
        calls.userUpsert = args;
        return { id: "user_1" };
      },
      deleteMany: async (args: unknown) => {
        calls.userDeleteMany = args;
        return { count: 1 };
      },
    },
    device: {
      create: async (args: unknown) => {
        calls.deviceCreate = args;
        return { id: "device_1", name: "iPhone" };
      },
      upsert: async (args: unknown) => {
        calls.deviceUpsert = args;
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
  it("iOS sessionを発行しrefresh tokenはhashだけ保存する", async () => {
    let createArgs: unknown;
    const db = {
      authSession: {
        create: async (args: unknown) => {
          createArgs = args;
          return { id: "synthetic_session_a" };
        },
      },
    };
    const ids = ["synthetic_session_a", "synthetic_family_a"];

    const issued = await createAuthSession(
      { userId: "synthetic_user_a", clientType: "ios", deviceId: "synthetic_device_a" },
      authConfig,
      db as never,
      NOW,
      () => "synthetic-raw-refresh-token",
      () => ids.shift()!,
    );

    expect(createArgs).toEqual({
      data: {
        id: "synthetic_session_a",
        userId: "synthetic_user_a",
        clientType: "ios",
        tokenFamilyId: "synthetic_family_a",
        refreshTokenHash: hashRefreshToken("synthetic-raw-refresh-token"),
        deviceId: "synthetic_device_a",
        rememberBrowser: false,
        lastUsedAt: NOW,
        idleExpiresAt: new Date("2026-08-13T00:00:00.000Z"),
        absoluteExpiresAt: new Date("2026-10-12T00:00:00.000Z"),
      },
    });
    expect(JSON.stringify(createArgs)).not.toContain("synthetic-raw-refresh-token");
    expect(issued.refreshToken).toBe("synthetic-raw-refresh-token");
    await expect(verifyAccessToken(issued.accessToken, authConfig, NOW)).resolves.toMatchObject({
      userId: "synthetic_user_a",
      sessionId: "synthetic_session_a",
    });
  });

  it("保持しないWeb sessionはサーバー側も24時間で失効する", async () => {
    let createArgs: { data: { idleExpiresAt: Date; absoluteExpiresAt: Date } } | undefined;
    const db = {
      authSession: {
        create: async (args: { data: { idleExpiresAt: Date; absoluteExpiresAt: Date } }) => {
          createArgs = args;
          return { id: "synthetic_session_web" };
        },
      },
    };
    const ids = ["synthetic_session_web", "synthetic_family_web"];

    await createAuthSession(
      { userId: "synthetic_user_a", clientType: "web", rememberBrowser: false },
      authConfig,
      db as never,
      NOW,
      () => "synthetic-web-refresh-token",
      () => ids.shift()!,
    );

    expect(createArgs?.data.idleExpiresAt.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(createArgs?.data.absoluteExpiresAt.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("refresh時は新世代を作り、旧tokenを使用済みにする", async () => {
    const calls: unknown[] = [];
    const current = {
      id: "synthetic_session_old",
      userId: "synthetic_user_a",
      clientType: "ios",
      tokenFamilyId: "synthetic_family_a",
      deviceId: "synthetic_device_a",
      rememberBrowser: false,
      replacedBySessionId: null,
      idleExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
      absoluteExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
      revokedAt: null,
    } as const;
    const tx = {
      authSession: {
        findUnique: async () => current,
        create: async (args: unknown) => {
          calls.push(args);
          return {};
        },
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
      },
    };
    const db = {
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      authSession: { updateMany: async () => ({ count: 0 }) },
    };

    const result = await rotateAuthSession(
      "synthetic-refresh-old",
      authConfig,
      db as never,
      NOW,
      () => "synthetic-refresh-new",
      () => "synthetic_session_new",
    );

    expect(result).toMatchObject({
      sessionId: "synthetic_session_new",
      refreshToken: "synthetic-refresh-new",
      refreshAbsoluteExpiresAt: current.absoluteExpiresAt,
    });
    expect(calls[0]).toMatchObject({
      data: {
        tokenFamilyId: "synthetic_family_a",
        refreshTokenHash: hashRefreshToken("synthetic-refresh-new"),
        idleExpiresAt: new Date("2026-08-13T00:00:00.000Z"),
        absoluteExpiresAt: current.absoluteExpiresAt,
      },
    });
    expect(calls[1]).toMatchObject({
      where: {
        id: "synthetic_session_old",
        refreshTokenHash: hashRefreshToken("synthetic-refresh-old"),
        replacedBySessionId: null,
        revokedAt: null,
      },
      data: {
        replacedBySessionId: "synthetic_session_new",
        revokeReason: "rotated",
      },
    });
  });

  it("条件更新の競合時はtoken familyを失効して安全なエラーにする", async () => {
    let familyRevocation: unknown;
    const current = {
      id: "synthetic_session_old",
      userId: "synthetic_user_a",
      clientType: "ios",
      tokenFamilyId: "synthetic_family_a",
      deviceId: null,
      rememberBrowser: false,
      replacedBySessionId: null,
      idleExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
      absoluteExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
      revokedAt: null,
    } as const;
    const tx = {
      authSession: {
        findUnique: async () => current,
        create: async () => ({}),
        updateMany: async () => ({ count: 0 }),
      },
    };
    const db = {
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      authSession: {
        updateMany: async (args: unknown) => {
          familyRevocation = args;
          return { count: 1 };
        },
      },
    };

    await expect(
      rotateAuthSession(
        "synthetic-refresh-old",
        authConfig,
        db as never,
        NOW,
        () => "synthetic-refresh-loser",
        () => "synthetic_session_loser",
      ),
    ).rejects.toBeInstanceOf(RefreshSessionError);
    expect(familyRevocation).toEqual({
      where: { tokenFamilyId: "synthetic_family_a", revokedAt: null },
      data: { revokedAt: NOW, revokeReason: "refresh_token_reuse" },
    });
  });

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
      undefined,
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

  it("clientDeviceId がある場合は同じ端末を 1 レコードへ upsert する", async () => {
    const { db, calls } = fakeDb();
    const result = await registerDeviceForAppleUser(
      "user_1",
      "iPhone",
      "synthetic-client-device-a",
      db as never,
      () => "raw-device-token",
    );

    expect(result).toEqual({
      device: { id: "device_1", name: "iPhone" },
      deviceSyncToken: "raw-device-token",
    });
    expect(calls.deviceCreate).toBeUndefined();
    expect(calls.deviceUpsert).toEqual({
      where: {
        userId_clientDeviceId: {
          userId: "user_1",
          clientDeviceId: "synthetic-client-device-a",
        },
      },
      create: {
        userId: "user_1",
        clientDeviceId: "synthetic-client-device-a",
        name: "iPhone",
        tokenHash: hashDeviceSyncToken("raw-device-token"),
      },
      update: {
        name: "iPhone",
        tokenHash: hashDeviceSyncToken("raw-device-token"),
        revokedAt: null,
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

  it("Apple subject hash に一致するユーザーを物理削除する", async () => {
    const { db, calls } = fakeDb();
    await expect(
      deleteAppleUserAccount({ subjectHash: "subject-hash" }, db as never),
    ).resolves.toBe(true);

    expect(calls.userDeleteMany).toEqual({
      where: { appleSubjectHash: "subject-hash" },
    });
  });
});
