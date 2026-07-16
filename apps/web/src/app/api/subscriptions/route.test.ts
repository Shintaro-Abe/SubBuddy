import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  authenticateRequest: vi.fn(),
}));

vi.mock("@/config/auth", () => ({ parseAuthConfig: mocks.parseAuthConfig }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  authenticateRequest: mocks.authenticateRequest,
}));

import { POST } from "./route";

describe("POST /api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
  });

  it("認証処理の予期しない例外は500応答になる", async () => {
    mocks.authenticateRequest.mockRejectedValue(new Error("synthetic database failure"));
    const response = await POST(
      new Request("https://subbuddy.example/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal server error" });
  });
});
