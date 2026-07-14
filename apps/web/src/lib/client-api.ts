"use client";

let refreshInFlight: Promise<boolean> | null = null;

const CSRF_COOKIE_NAMES = new Set([
  "__Host-subbuddy-testflight-csrf",
  "__Host-subbuddy-csrf",
]);

export function csrfTokenFromCookie(cookieHeader = document.cookie): string | null {
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...valueParts] = part.trim().split("=");
    if (CSRF_COOKIE_NAMES.has(rawName)) return valueParts.join("=") || null;
  }
  return null;
}

async function performRefresh(): Promise<boolean> {
  const csrfToken = csrfTokenFromCookie();
  if (!csrfToken) return false;
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
    body: "{}",
  });
  return response.ok;
}

export function refreshBrowserSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshPromise = (
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("subbuddy-auth-refresh", async () => await performRefresh())
      : performRefresh()
  ) as Promise<boolean>;
  refreshInFlight = refreshPromise.finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = csrfTokenFromCookie();
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
  }

  return fetch(input, { ...init, headers }).then(async (response) => {
    const target = typeof input === "string" ? input : input.toString();
    if (response.status !== 401 || target.includes("/api/auth/refresh")) return response;

    if (!(await refreshBrowserSession())) return response;
    const retryHeaders = new Headers(init.headers);
    const rotatedCsrfToken = csrfTokenFromCookie();
    if (rotatedCsrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      retryHeaders.set("x-csrf-token", rotatedCsrfToken);
    }
    return fetch(input, { ...init, headers: retryHeaders });
  });
}
