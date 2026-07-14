import { describe, expect, it } from "vitest";
import { AuthConfigError, parseAuthConfig } from "@/config/auth";

const SECRET = "c3ludGhldGljLWF1dGgtc2VjcmV0LWZvci10ZXN0cy1vbmx5LTEyMzQ1Njc4OTA";

function cloudEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    SUBBUDDY_MODE: "cloud-testflight",
    DATABASE_URL: "postgresql://synthetic:synthetic@localhost:5432/synthetic",
    APPLE_ALLOWED_CLIENT_IDS: "com.subbuddy.web,com.subbuddy.app",
    APPLE_SUBJECT_HASH_SALT: "synthetic-subject-hash-salt-32-bytes",
    AUTH_TOKEN_ISSUER: "https://testflight-api.subbuddy.example",
    AUTH_TOKEN_AUDIENCE: "subbuddy-cloud-testflight",
    AUTH_JWT_SECRET_BASE64URL: SECRET,
    AUTH_ACCESS_TTL_SECONDS: "900",
    AUTH_WEB_SESSION_TTL_SECONDS: "86400",
    AUTH_IDLE_TTL_SECONDS: "2592000",
    AUTH_ABSOLUTE_TTL_SECONDS: "7776000",
    AUTH_APPLE_OUTAGE_GRACE_SECONDS: "259200",
    AUTH_ACCESS_COOKIE_NAME: "__Host-subbuddy-testflight-access",
    AUTH_REFRESH_COOKIE_NAME: "__Host-subbuddy-testflight-refresh",
    AUTH_CSRF_COOKIE_NAME: "__Host-subbuddy-testflight-csrf",
    AUTH_ALLOWED_ORIGINS: "https://testflight.subbuddy.example",
    ...overrides,
  };
}

describe("authentication runtime configuration", () => {
  it("localだけはcloud認証設定なしで起動できる", () => {
    expect(parseAuthConfig({ SUBBUDDY_MODE: "local" })).toEqual({ mode: "local" });
  });

  it("不明なmodeをlocalへフォールバックしない", () => {
    expect(() => parseAuthConfig({ SUBBUDDY_MODE: "staging" })).toThrow(AuthConfigError);
    expect(() => parseAuthConfig({})).toThrow(AuthConfigError);
  });

  it("cloud-testflightの環境別設定を読み込む", () => {
    const config = parseAuthConfig(cloudEnv());
    expect(config).toMatchObject({
      mode: "cloud-testflight",
      accessTtlSeconds: 900,
      webSessionTtlSeconds: 86400,
      idleTtlSeconds: 2592000,
      absoluteTtlSeconds: 7776000,
      appleOutageGraceSeconds: 259200,
      allowedOrigins: ["https://testflight.subbuddy.example"],
    });
    expect(config.mode === "local" ? 0 : config.jwtSecret).toHaveLength(47);
  });

  it("cloud設定不足を秘密値なしのエラーで拒否する", () => {
    const env = cloudEnv({ AUTH_JWT_SECRET_BASE64URL: undefined });
    expect(() => parseAuthConfig(env)).toThrow("AUTH_JWT_SECRET_BASE64URL");
    try {
      parseAuthConfig(env);
    } catch (error) {
      expect(String(error)).not.toContain(SECRET);
    }
  });

  it("承認済み期限と72時間上限を外れる設定を拒否する", () => {
    expect(() => parseAuthConfig(cloudEnv({ AUTH_ACCESS_TTL_SECONDS: "901" }))).toThrow(
      "AUTH_ACCESS_TTL_SECONDS",
    );
    expect(() => parseAuthConfig(cloudEnv({ AUTH_APPLE_OUTAGE_GRACE_SECONDS: "259201" }))).toThrow(
      "AUTH_APPLE_OUTAGE_GRACE_SECONDS",
    );
  });

  it("環境別Cookie名、HTTPS Origin、Web/iOS Apple IDを必須にする", () => {
    expect(() => parseAuthConfig(cloudEnv({ AUTH_ACCESS_COOKIE_NAME: "subbuddy-access" }))).toThrow(
      "__Host-subbuddy-testflight-",
    );
    expect(() =>
      parseAuthConfig(cloudEnv({ AUTH_ALLOWED_ORIGINS: "http://localhost:3000" })),
    ).toThrow("HTTPS origins");
    expect(() =>
      parseAuthConfig(cloudEnv({ APPLE_ALLOWED_CLIENT_IDS: "com.subbuddy.app" })),
    ).toThrow("Web and iOS");
  });

  it("productionではproduction専用Cookie名を要求する", () => {
    const config = parseAuthConfig(
      cloudEnv({
        SUBBUDDY_MODE: "production",
        AUTH_ACCESS_COOKIE_NAME: "__Host-subbuddy-access",
        AUTH_REFRESH_COOKIE_NAME: "__Host-subbuddy-refresh",
        AUTH_CSRF_COOKIE_NAME: "__Host-subbuddy-csrf",
      }),
    );
    expect(config.mode).toBe("production");
  });
});
