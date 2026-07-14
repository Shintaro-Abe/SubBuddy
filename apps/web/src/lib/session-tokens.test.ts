import { describe, expect, it } from "vitest";
import type { CloudAuthConfig } from "@/config/auth";
import {
  AccessTokenError,
  generateRefreshToken,
  hashRefreshToken,
  issueAccessToken,
  verifyAccessToken,
} from "@/lib/session-tokens";

const NOW = new Date("2026-07-14T00:00:00.000Z");
const config: CloudAuthConfig = {
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

describe("session tokens", () => {
  it("15分有効で必須claimを持つaccess tokenを発行・検証する", async () => {
    const issued = await issueAccessToken("synthetic_user_a", "synthetic_session_a", config, NOW);
    const claims = await verifyAccessToken(issued.token, config, NOW);

    expect(issued.expiresAt.toISOString()).toBe("2026-07-14T00:15:00.000Z");
    expect(claims).toMatchObject({
      userId: "synthetic_user_a",
      sessionId: "synthetic_session_a",
      issuedAt: NOW,
      expiresAt: issued.expiresAt,
    });
    expect(claims.tokenId).toBeTruthy();
  });

  it("期限切れ、issuer違い、audience違いを同じ安全なエラーで拒否する", async () => {
    const issued = await issueAccessToken("synthetic_user_a", "synthetic_session_a", config, NOW);
    await expect(
      verifyAccessToken(issued.token, config, new Date("2026-07-14T00:15:01.000Z")),
    ).rejects.toBeInstanceOf(AccessTokenError);
    await expect(
      verifyAccessToken(issued.token, { ...config, tokenIssuer: "https://other.example" }, NOW),
    ).rejects.toBeInstanceOf(AccessTokenError);
    await expect(
      verifyAccessToken(issued.token, { ...config, tokenAudience: "other" }, NOW),
    ).rejects.toBeInstanceOf(AccessTokenError);
  });

  it("refresh tokenは256bit乱数で、保存用hashはSHA-256にする", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(first).not.toBe(second);
    expect(hashRefreshToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(first)).not.toContain(first);
  });
});
