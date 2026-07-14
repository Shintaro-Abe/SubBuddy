import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import type { CloudAuthConfig } from "@/config/auth";
import { authFlowCookieNames, setWebSessionCookies } from "@/lib/web-auth";
import type { IssuedSession } from "@/services/auth";

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

const session: IssuedSession = {
  sessionId: "synthetic_session_a",
  clientType: "web",
  rememberBrowser: false,
  accessToken: "synthetic-access-token",
  accessExpiresAt: new Date("2026-07-14T12:15:00.000Z"),
  refreshToken: "synthetic-refresh-token",
  refreshIdleExpiresAt: new Date("2026-07-15T12:00:00.000Z"),
  refreshAbsoluteExpiresAt: new Date("2026-07-15T12:00:00.000Z"),
};

describe("web authentication cookies", () => {
  it("OAuth flow cookie名は環境別prefixから固定生成する", () => {
    expect(authFlowCookieNames(config)).toEqual({
      state: "__Host-subbuddy-testflight-oauth-state",
      nonce: "__Host-subbuddy-testflight-oauth-nonce",
      remember: "__Host-subbuddy-testflight-oauth-remember",
    });
  });

  it("保持オフではaccessとrefreshをブラウザsession Cookieにする", () => {
    const response = NextResponse.json({ ok: true });
    setWebSessionCookies(
      response,
      config,
      session,
      false,
      "synthetic-csrf-token",
      new Date("2026-07-14T12:00:00.000Z"),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain(`${config.accessCookieName}=synthetic-access-token`);
    expect(setCookie).toContain(`${config.refreshCookieName}=synthetic-refresh-token`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).not.toContain("Max-Age");
  });

  it("保持オンでは更新Cookieへ30日未使用期限を設定する", () => {
    const response = NextResponse.json({ ok: true });
    setWebSessionCookies(
      response,
      config,
      {
        ...session,
        rememberBrowser: true,
        refreshIdleExpiresAt: new Date("2026-08-13T12:00:00.000Z"),
        refreshAbsoluteExpiresAt: new Date("2026-10-12T12:00:00.000Z"),
      },
      true,
      "synthetic-csrf-token",
      new Date("2026-07-14T12:00:00.000Z"),
    );

    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
  });
});
