import { describe, expect, it, vi } from "vitest";
import { hashDeviceSyncToken } from "@/lib/auth";
import {
  AppleOutageError,
  createAuthSession,
  deleteAppleUserAccount,
  exchangeAppleIdentityForSession,
  listActiveSessions,
  RefreshSessionError,
  registerDeviceForAppleUser,
  registerDeviceForSession,
  revokeDeviceForAppleUser,
  revokeSession,
  SessionLimitError,
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
  appleWebClientId: "com.subbuddy.web",
  appleRedirectUri: "https://testflight.subbuddy.example/sign-in",
  appleSubjectHashSalt: "synthetic-subject-hash-salt-32-bytes",
  tokenIssuer: "https://testflight-api.subbuddy.example",
  tokenAudience: "subbuddy-cloud-testflight",
  jwtSecret: new TextEncoder().encode("synthetic-jwt-secret-for-tests-only"),
  accessTtlSeconds: 900,
  webSessionTtlSeconds: 86400,
  idleTtlSeconds: 2592000,
  absoluteTtlSeconds: 7776000,
  appleOutageGraceSeconds: 259200,
  appleOutageStartedAt: null,
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
  it("有効sessionが10件なら新規sessionだけを拒否する", async () => {
    const create = vi.fn();
    const db = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
      authSession: { count: async () => 10, create },
    };

    await expect(
      createAuthSession(
        { userId: "synthetic_user_a", clientType: "ios" },
        authConfig,
        db as never,
        NOW,
      ),
    ).rejects.toBeInstanceOf(SessionLimitError);
    expect(create).not.toHaveBeenCalled();
  });

  it("iOS sessionを発行しrefresh tokenはhashだけ保存する", async () => {
    let createArgs: unknown;
    const db = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
      authSession: {
        count: async () => 0,
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
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
      authSession: {
        count: async () => 0,
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

  it("session一覧はPIIを含めず現在sessionだけを識別する", async () => {
    const db = {
      authSession: {
        findMany: async () => [
          {
            id: "synthetic_session_a",
            clientType: "ios",
            createdAt: NOW,
            lastUsedAt: NOW,
            device: { name: "Test iPhone" },
          },
        ],
      },
    };

    await expect(
      listActiveSessions("synthetic_user_a", "synthetic_session_a", db as never, NOW),
    ).resolves.toEqual([
      {
        id: "synthetic_session_a",
        clientType: "ios",
        deviceName: "Test iPhone",
        createdAt: NOW,
        lastUsedAt: NOW,
        current: true,
      },
    ]);
  });

  it("session失効時は紐づく端末tokenも同時に失効する", async () => {
    const calls: unknown[] = [];
    const tx = {
      authSession: {
        findFirst: async () => ({ deviceId: "synthetic_device_a" }),
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
      },
      device: {
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
      },
    };
    const db = {
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      authSession: tx.authSession,
      device: tx.device,
    };

    await expect(
      revokeSession("synthetic_user_a", "synthetic_session_a", "signed_out", db as never, NOW),
    ).resolves.toBe(true);
    expect(calls).toContainEqual({
      where: {
        id: "synthetic_device_a",
        userId: "synthetic_user_a",
        revokedAt: null,
      },
      data: { revokedAt: NOW },
    });
  });

  it("Apple subject hashで解決した同じユーザーへiOS sessionを紐づける", async () => {
    const storedUserIds: string[] = [];
    const db = {
      user: {
        upsert: async () => ({ id: "synthetic_user_shared" }),
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
      authSession: {
        count: async () => 0,
        create: async (args: { data: { userId: string } }) => {
          storedUserIds.push(args.data.userId);
          return { id: args.data.userId };
        },
      },
    };

    const result = await exchangeAppleIdentityForSession(
      { subjectHash: "synthetic-shared-subject-hash" },
      { clientType: "ios" },
      authConfig,
      db as never,
      NOW,
    );

    expect(result.actor.userId).toBe("synthetic_user_shared");
    expect(storedUserIds).toEqual(["synthetic_user_shared"]);
    await expect(
      verifyAccessToken(result.session.accessToken, authConfig, NOW),
    ).resolves.toMatchObject({
      userId: "synthetic_user_shared",
      sessionId: result.session.sessionId,
    });
  });

  it("Apple障害中は新規session交換を拒否する", async () => {
    const db = {
      user: { upsert: vi.fn() },
      authSession: { count: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(),
    };

    await expect(
      exchangeAppleIdentityForSession(
        { subjectHash: "synthetic-shared-subject-hash" },
        { clientType: "ios" },
        { ...authConfig, appleOutageStartedAt: NOW },
        db as never,
        NOW,
      ),
    ).rejects.toBeInstanceOf(AppleOutageError);
    expect(db.user.upsert).not.toHaveBeenCalled();
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

  it("session紐付け失敗時はtransactionを失敗として扱う", async () => {
    const { db } = fakeDb();
    const tx = {
      ...db,
      authSession: { updateMany: async () => ({ count: 0 }) },
    };
    const transactionDb = {
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx),
    };

    await expect(
      registerDeviceForSession(
        "user_1",
        "missing_session",
        "iPhone",
        "synthetic-client-device-a",
        transactionDb as never,
        () => "raw-device-token",
      ),
    ).resolves.toBeNull();
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
