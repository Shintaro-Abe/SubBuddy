import { describe, expect, it } from "vitest";
import { csrfTokenFromCookie } from "@/lib/client-api";

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
    expect(csrfTokenFromCookie("third-party-csrf=wrong")).toBeNull();
  });
});
