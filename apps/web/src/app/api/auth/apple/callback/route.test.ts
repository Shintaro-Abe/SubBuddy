import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  verifyAppleIdentityToken: vi.fn(),
  exchangeAppleIdentityForSession: vi.fn(),
  upsertAppleUser: vi.fn(),
}));

vi.mock("@/config/auth", () => ({ parseAuthConfig: mocks.parseAuthConfig }));
vi.mock("@/lib/apple-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apple-auth")>()),
  verifyAppleIdentityToken: mocks.verifyAppleIdentityToken,
}));
vi.mock("@/services/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/auth")>()),
  exchangeAppleIdentityForSession: mocks.exchangeAppleIdentityForSession,
  upsertAppleUser: mocks.upsertAppleUser,
}));

import { POST } from "./route";
import { AppleIdentityTokenError } from "@/lib/apple-auth";

const config = {
  mode: "cloud-testflight",
  appleAllowedClientIds: ["com.subbuddy.web", "com.subbuddy.app"],
  appleSubjectHashSalt: "synthetic-subject-hash-salt-32-bytes",
  accessTtlSeconds: 900,
  accessCookieName: "__Host-subbuddy-testflight-access",
  refreshCookieName: "__Host-subbuddy-testflight-refresh",
  csrfCookieName: "__Host-subbuddy-testflight-csrf",
  allowedOrigins: ["https://testflight.subbuddy.example"],
};
const state = "synthetic-state-with-at-least-32-characters";
const nonce = "synthetic-nonce-with-at-least-32-characters";
const cookie = [
  `__Host-subbuddy-testflight-oauth-state=${state}`,
  `__Host-subbuddy-testflight-oauth-nonce=${nonce}`,
  "__Host-subbuddy-testflight-oauth-remember=0",
].join("; ");

function request(overrides: Record<string, unknown> = {}, origin = config.allowedOrigins[0]) {
  return new Request("https://testflight.subbuddy.example/api/auth/apple/callback", {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie },
    body: JSON.stringify({
      identityToken: "synthetic.identity.token",
      state,
      nonce,
      ...overrides,
    }),
  });
}

describe("POST /api/auth/apple/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue(config);
    mocks.verifyAppleIdentityToken.mockResolvedValue({ subjectHash: "synthetic-subject-hash" });
    mocks.exchangeAppleIdentityForSession.mockResolvedValue({
      actor: { kind: "user", userId: "synthetic_user_a", authProvider: "apple" },
      session: {
        sessionId: "synthetic_session_a",
        clientType: "web",
        rememberBrowser: false,
        accessToken: "synthetic-access-token",
        accessExpiresAt: new Date("2026-07-14T12:15:00.000Z"),
        refreshToken: "synthetic-refresh-token",
        refreshIdleExpiresAt: new Date("2026-07-15T12:00:00.000Z"),
        refreshAbsoluteExpiresAt: new Date("2026-07-15T12:00:00.000Z"),
      },
    });
  });

  it("一致するstate・nonceだけをsessionへ交換し固定URLを返す", async () => {
    const response = await POST(request({ redirectTo: "https://attacker.invalid" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ redirectTo: "/" });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.verifyAppleIdentityToken).toHaveBeenCalledWith("synthetic.identity.token", {
      allowedClientIds: config.appleAllowedClientIds,
      expectedNonce: nonce,
      subjectHashSalt: config.appleSubjectHashSalt,
    });
  });

  it("Apple token拒否時は値を含めず固定理由コードだけを記録する", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.verifyAppleIdentityToken.mockRejectedValue(
      new AppleIdentityTokenError("nonce_mismatch"),
    );

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(warn).toHaveBeenCalledWith("apple_web_auth_rejected", {
      reason: "nonce_mismatch",
    });
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("synthetic"));
  });

  it("state不一致はApple token検証前に403", async () => {
    const response = await POST(request({ state: "wrong-state-with-at-least-32-characters" }));
    expect(response.status).toBe(403);
    expect(mocks.verifyAppleIdentityToken).not.toHaveBeenCalled();
  });

  it("nonce不一致はApple token検証前に403", async () => {
    const response = await POST(
      request({ nonce: "wrong-nonce-with-at-least-32-characters" }),
    );
    expect(response.status).toBe(403);
    expect(mocks.verifyAppleIdentityToken).not.toHaveBeenCalled();
  });

  it("許可されていないOriginは403", async () => {
    const response = await POST(request({}, "https://attacker.invalid"));
    expect(response.status).toBe(403);
    expect(mocks.verifyAppleIdentityToken).not.toHaveBeenCalled();
  });
});
