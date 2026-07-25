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

import { DELETE } from "./route";

function request() {
  return new Request("https://subbuddy.example/api/sessions/synthetic-session-other", {
    method: "DELETE",
  });
}

describe("DELETE /api/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
    mocks.authenticateRequest.mockResolvedValue({
      actor: { kind: "user", userId: "synthetic-user-a", authProvider: "apple" },
      sessionId: "synthetic-session-current",
      transport: "cookie",
    });
    mocks.authorizeStateChange.mockReturnValue(true);
    mocks.revokeSession.mockResolvedValue(true);
  });

  it("本人の指定セッションだけを失効する", async () => {
    const response = await DELETE(request(), {
      params: Promise.resolve({ id: "synthetic-session-other" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revoked: true });
    expect(mocks.revokeSession).toHaveBeenCalledWith(
      "synthetic-user-a",
      "synthetic-session-other",
      "revoked_by_user",
    );
    expect(mocks.clearWebSessionCookies).not.toHaveBeenCalled();
  });

  it("現在のWebセッションを失効した場合はCookieも削除する", async () => {
    const response = await DELETE(request(), {
      params: Promise.resolve({ id: "synthetic-session-current" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.clearWebSessionCookies).toHaveBeenCalledOnce();
  });

  it("CSRF検証に失敗した要求を拒否する", async () => {
    mocks.authorizeStateChange.mockReturnValue(false);

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: "synthetic-session-other" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.revokeSession).not.toHaveBeenCalled();
  });
});
