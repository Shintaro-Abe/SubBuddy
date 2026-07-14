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

import { PUT } from "./route";

describe("PUT /api/subscriptions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
  });

  it("認証処理の予期しない例外は500応答になる", async () => {
    mocks.authenticateRequest.mockRejectedValue(new Error("synthetic database failure"));
    const response = await PUT(
      new Request("https://subbuddy.example/api/subscriptions/synthetic-subscription", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "synthetic-subscription" }) },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal server error" });
  });
});
