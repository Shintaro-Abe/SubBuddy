import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { issueAccessToken } from "@/lib/session-tokens";
import type { CloudAuthConfig } from "@/config/auth";

const NOW = new Date("2026-07-14T12:00:00.000Z");
const SECRET = Buffer.from("synthetic-jwt-secret-exactly-32b!").toString("base64url");

const config: CloudAuthConfig = {
  mode: "cloud-testflight",
  databaseUrl: "postgresql://synthetic.invalid/synthetic",
  appleAllowedClientIds: ["com.subbuddy.web", "com.subbuddy.app"],
  appleWebClientId: "com.subbuddy.web",
  appleRedirectUri: "https://testflight.subbuddy.example/sign-in",
  appleSubjectHashSalt: "synthetic-subject-hash-salt-32-bytes",
  tokenIssuer: "https://testflight-api.subbuddy.example",
  tokenAudience: "subbuddy-cloud-testflight",
  jwtSecret: Buffer.from(SECRET, "base64url"),
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

function stubCloudEnvironment() {
  vi.stubEnv("SUBBUDDY_MODE", config.mode);
  vi.stubEnv("DATABASE_URL", config.databaseUrl);
  vi.stubEnv("APPLE_ALLOWED_CLIENT_IDS", config.appleAllowedClientIds.join(","));
  vi.stubEnv("APPLE_CLIENT_ID", config.appleWebClientId);
  vi.stubEnv("APPLE_REDIRECT_URI", config.appleRedirectUri);
  vi.stubEnv("APPLE_SUBJECT_HASH_SALT", config.appleSubjectHashSalt);
  vi.stubEnv("AUTH_TOKEN_ISSUER", config.tokenIssuer);
  vi.stubEnv("AUTH_TOKEN_AUDIENCE", config.tokenAudience);
  vi.stubEnv("AUTH_JWT_SECRET_BASE64URL", SECRET);
  vi.stubEnv("AUTH_ACCESS_TTL_SECONDS", String(config.accessTtlSeconds));
  vi.stubEnv("AUTH_WEB_SESSION_TTL_SECONDS", String(config.webSessionTtlSeconds));
  vi.stubEnv("AUTH_IDLE_TTL_SECONDS", String(config.idleTtlSeconds));
  vi.stubEnv("AUTH_ABSOLUTE_TTL_SECONDS", String(config.absoluteTtlSeconds));
  vi.stubEnv("AUTH_APPLE_OUTAGE_GRACE_SECONDS", String(config.appleOutageGraceSeconds));
  vi.stubEnv("AUTH_ACCESS_COOKIE_NAME", config.accessCookieName);
  vi.stubEnv("AUTH_REFRESH_COOKIE_NAME", config.refreshCookieName);
  vi.stubEnv("AUTH_CSRF_COOKIE_NAME", config.csrfCookieName);
  vi.stubEnv("AUTH_ALLOWED_ORIGINS", config.allowedOrigins.join(","));
}

describe("request authentication boundary", () => {
  beforeEach(stubCloudEnvironment);
  afterEach(() => vi.unstubAllEnvs());

  it("2人のaccess tokenをそれぞれのuserIdへ解決する", async () => {
    for (const suffix of ["a", "b"]) {
      const token = await issueAccessToken(
        `synthetic_user_${suffix}`,
        `session_${suffix}`,
        config,
        NOW,
      );
      const db = {
        authSession: {
          findUnique: vi.fn().mockResolvedValue({
            userId: `synthetic_user_${suffix}`,
            revokedAt: null,
            idleExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
            absoluteExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
          }),
        },
      };
      const request = new Request("https://testflight.subbuddy.example/api/subscriptions", {
        headers: { authorization: `Bearer ${token.token}` },
      });

      await expect(authenticateRequest(request, db as never, NOW)).resolves.toMatchObject({
        actor: { userId: `synthetic_user_${suffix}` },
        sessionId: `session_${suffix}`,
        transport: "bearer",
      });
    }
  });

  it("tokenのuserIdとsession所有者が違う場合は拒否する", async () => {
    const token = await issueAccessToken("synthetic_user_a", "session_a", config, NOW);
    const db = {
      authSession: {
        findUnique: vi.fn().mockResolvedValue({
          userId: "synthetic_user_b",
          revokedAt: null,
          idleExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
          absoluteExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
        }),
      },
    };
    const request = new Request("https://testflight.subbuddy.example/api/subscriptions", {
      headers: { authorization: `Bearer ${token.token}` },
    });

    await expect(authenticateRequest(request, db as never, NOW)).resolves.toBeNull();
  });

  it("Cookieの変更要求は許可OriginとCSRF同値が両方必要", () => {
    const auth = {
      actor: { kind: "user" as const, userId: "synthetic_user_a", authProvider: "apple" as const },
      sessionId: "session_a",
      transport: "cookie" as const,
    };
    const valid = new Request("https://testflight.subbuddy.example/api/subscriptions", {
      method: "POST",
      headers: {
        origin: "https://testflight.subbuddy.example",
        cookie: `${config.csrfCookieName}=synthetic-csrf`,
        "x-csrf-token": "synthetic-csrf",
      },
    });
    const wrongOrigin = new Request(valid, {
      headers: { ...Object.fromEntries(valid.headers), origin: "https://attacker.invalid" },
    });
    const wrongToken = new Request(valid, {
      headers: { ...Object.fromEntries(valid.headers), "x-csrf-token": "wrong" },
    });

    expect(authorizeStateChange(valid, auth, config)).toBe(true);
    expect(authorizeStateChange(wrongOrigin, auth, config)).toBe(false);
    expect(authorizeStateChange(wrongToken, auth, config)).toBe(false);
  });

  it("localモードだけは認証情報なしでuser_localを返す", async () => {
    vi.stubEnv("SUBBUDDY_MODE", "local");
    await expect(
      authenticateRequest(new Request("http://localhost/api/subscriptions"), {} as never, NOW),
    ).resolves.toMatchObject({
      actor: { userId: "user_local", authProvider: "local" },
      transport: "local",
    });
  });
});
