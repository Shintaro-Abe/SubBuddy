import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  verifyAppleIdentityToken: vi.fn(),
  exchangeAppleIdentityForSession: vi.fn(),
  upsertAppleUser: vi.fn(),
}));

vi.mock("@/config/auth", () => ({
  parseAuthConfig: mocks.parseAuthConfig,
}));

vi.mock("@/lib/apple-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apple-auth")>()),
  verifyAppleIdentityToken: mocks.verifyAppleIdentityToken,
}));

vi.mock("@/services/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/auth")>()),
  exchangeAppleIdentityForSession: mocks.exchangeAppleIdentityForSession,
  upsertAppleUser: mocks.upsertAppleUser,
}));

import { hashAppleNonce } from "@/lib/apple-auth";
import { AppleOutageError } from "@/services/auth";
import { POST } from "./route";

const identity = {
  subject: "synthetic-apple-subject",
  subjectHash: "synthetic-apple-subject-hash",
};
const actor = {
  kind: "user",
  userId: "synthetic_user_shared",
  authProvider: "apple",
};
const nonce = "synthetic-native-nonce-with-enough-entropy";

function request(body: unknown) {
  return new Request("https://testflight.subbuddy.example/api/auth/apple/native", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/apple/native", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAppleIdentityToken.mockResolvedValue(identity);
    mocks.upsertAppleUser.mockResolvedValue(actor);
  });

  it("cloudでは検証済みApple identityをiOS sessionへ交換する", async () => {
    const config = {
      mode: "cloud-testflight",
      appleAllowedClientIds: ["com.subbuddy.web", "com.subbuddy.app"],
      appleSubjectHashSalt: "synthetic-subject-hash-salt-32-bytes",
    };
    const session = {
      sessionId: "synthetic_session_a",
      accessToken: "synthetic-access-token",
      refreshToken: "synthetic-refresh-token",
    };
    mocks.parseAuthConfig.mockReturnValue(config);
    mocks.exchangeAppleIdentityForSession.mockResolvedValue({ actor, session });

    const response = await POST(request({ identityToken: "synthetic.identity.token", nonce }));

    expect(response.status).toBe(200);
    expect(mocks.verifyAppleIdentityToken).toHaveBeenCalledWith("synthetic.identity.token", {
      allowedClientIds: config.appleAllowedClientIds,
      expectedNonce: hashAppleNonce(nonce),
      subjectHashSalt: config.appleSubjectHashSalt,
    });
    expect(mocks.exchangeAppleIdentityForSession).toHaveBeenCalledWith(
      identity,
      { clientType: "ios" },
      config,
    );
    expect(await response.json()).toEqual({ actor, session });
  });

  it("localではsessionを発行せず既存のApple user解決を維持する", async () => {
    mocks.parseAuthConfig.mockReturnValue({ mode: "local" });

    const response = await POST(request({ identityToken: "synthetic.identity.token", nonce }));

    expect(response.status).toBe(200);
    expect(mocks.exchangeAppleIdentityForSession).not.toHaveBeenCalled();
    expect(mocks.upsertAppleUser).toHaveBeenCalledWith(identity);
    expect(await response.json()).toEqual({ actor });
  });

  it("nonceがない要求はApple検証前に拒否する", async () => {
    const response = await POST(request({ identityToken: "synthetic.identity.token" }));

    expect(response.status).toBe(400);
    expect(mocks.parseAuthConfig).not.toHaveBeenCalled();
    expect(mocks.verifyAppleIdentityToken).not.toHaveBeenCalled();
  });

  it("Apple障害中の新規session交換は503", async () => {
    mocks.parseAuthConfig.mockReturnValue({
      mode: "cloud-testflight",
      appleAllowedClientIds: ["com.subbuddy.web", "com.subbuddy.app"],
      appleSubjectHashSalt: "synthetic-subject-hash-salt-32-bytes",
    });
    mocks.exchangeAppleIdentityForSession.mockRejectedValue(new AppleOutageError());

    const response = await POST(request({ identityToken: "synthetic.identity.token", nonce }));
    expect(response.status).toBe(503);
  });
});
