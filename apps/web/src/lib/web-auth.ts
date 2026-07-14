import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { CloudAuthConfig } from "@/config/auth";
import type { IssuedSession } from "@/services/auth";

const AUTH_FLOW_TTL_SECONDS = 10 * 60;

export type AuthFlowCookieNames = {
  state: string;
  nonce: string;
  remember: string;
};

export function generateBrowserSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function authFlowCookieNames(config: CloudAuthConfig): AuthFlowCookieNames {
  const prefix = config.accessCookieName.slice(0, -"access".length);
  return {
    state: `${prefix}oauth-state`,
    nonce: `${prefix}oauth-nonce`,
    remember: `${prefix}oauth-remember`,
  };
}

function secureCookie(maxAge?: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export function setAuthFlowCookies(
  response: NextResponse,
  config: CloudAuthConfig,
  state: string,
  nonce: string,
  rememberBrowser: boolean,
): void {
  const names = authFlowCookieNames(config);
  const options = secureCookie(AUTH_FLOW_TTL_SECONDS);
  response.cookies.set(names.state, state, options);
  response.cookies.set(names.nonce, nonce, options);
  response.cookies.set(names.remember, rememberBrowser ? "1" : "0", options);
}

export function clearAuthFlowCookies(response: NextResponse, config: CloudAuthConfig): void {
  for (const name of Object.values(authFlowCookieNames(config))) {
    response.cookies.set(name, "", secureCookie(0));
  }
}

export function setWebSessionCookies(
  response: NextResponse,
  config: CloudAuthConfig,
  session: IssuedSession,
  rememberBrowser: boolean,
  csrfToken = generateBrowserSecret(),
  now = new Date(),
): string {
  const persistentMaxAge = rememberBrowser
    ? Math.max(0, Math.floor((session.refreshIdleExpiresAt.getTime() - now.getTime()) / 1000))
    : undefined;
  response.cookies.set(
    config.accessCookieName,
    session.accessToken,
    secureCookie(rememberBrowser ? config.accessTtlSeconds : undefined),
  );
  response.cookies.set(
    config.refreshCookieName,
    session.refreshToken,
    secureCookie(persistentMaxAge),
  );
  response.cookies.set(config.csrfCookieName, csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    ...(persistentMaxAge === undefined ? {} : { maxAge: persistentMaxAge }),
  });
  return csrfToken;
}

export function clearWebSessionCookies(response: NextResponse, config: CloudAuthConfig): void {
  response.cookies.set(config.accessCookieName, "", secureCookie(0));
  response.cookies.set(config.refreshCookieName, "", secureCookie(0));
  response.cookies.set(config.csrfCookieName, "", {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
