import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch, csrfTokenFromCookie } from "@/lib/client-api";

afterEach(() => vi.unstubAllGlobals());

describe("csrfTokenFromCookie", () => {
  it("TestFlight用Cookie名を完全一致で取得する", () => {
    expect(
      csrfTokenFromCookie(
        "unrelated-csrf=wrong; __Host-subbuddy-testflight-csrf=synthetic-token",
      ),
    ).toBe("synthetic-token");
  });

  it("本番用Cookie名を完全一致で取得する", () => {
    expect(csrfTokenFromCookie("__Host-subbuddy-csrf=synthetic-token")).toBe(
      "synthetic-token",
    );
  });

  it("似た名前のCookieをCSRF tokenとして扱わない", () => {
    expect(csrfTokenFromCookie("__Host-subbuddy-csrf-extra=wrong")).toBeNull();
  });

  it("Request形式のrefresh要求を再試行しない", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://subbuddy.example/api/auth/refresh", { method: "POST" });
    const response = await authenticatedFetch(request);

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
