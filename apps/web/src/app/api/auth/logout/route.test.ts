import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  authenticateRequest: vi.fn(),
  authorizeStateChange: vi.fn(),
  clearWebSessionCookies: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("@/config/auth", () => ({ parseAuthConfig: mocks.parseAuthConfig }));
vi.mock("@/lib/auth", () => ({
  authenticateRequest: mocks.authenticateRequest,
  authorizeStateChange: mocks.authorizeStateChange,
}));
vi.mock("@/lib/web-auth", () => ({ clearWebSessionCookies: mocks.clearWebSessionCookies }));
vi.mock("@/services/auth", () => ({ revokeSession: mocks.revokeSession }));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
    mocks.authenticateRequest.mockResolvedValue({
      actor: { kind: "user", userId: "synthetic-user-a", authProvider: "apple" },
      sessionId: "synthetic-session-a",
      transport: "cookie",
    });
    mocks.authorizeStateChange.mockReturnValue(true);
    mocks.revokeSession.mockResolvedValue(undefined);
  });

  it("本人のWebセッションを失効し、Cookieを消去する", async () => {
    const response = await POST(
      new Request("https://subbuddy.example/api/auth/logout", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ signedOut: true });
    expect(mocks.authorizeStateChange).toHaveBeenCalledOnce();
    expect(mocks.revokeSession).toHaveBeenCalledWith(
      "synthetic-user-a",
      "synthetic-session-a",
      "signed_out",
    );
    expect(mocks.clearWebSessionCookies).toHaveBeenCalledOnce();
  });

  it("CSRF検証に失敗した要求を拒否する", async () => {
    mocks.authorizeStateChange.mockReturnValue(false);

    const response = await POST(
      new Request("https://subbuddy.example/api/auth/logout", { method: "POST" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.revokeSession).not.toHaveBeenCalled();
    expect(mocks.clearWebSessionCookies).not.toHaveBeenCalled();
  });

  it("未認証の要求を拒否する", async () => {
    mocks.authenticateRequest.mockResolvedValue(null);

    const response = await POST(
      new Request("https://subbuddy.example/api/auth/logout", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.revokeSession).not.toHaveBeenCalled();
  });
});
