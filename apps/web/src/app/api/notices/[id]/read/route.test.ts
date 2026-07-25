import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  authenticateRequest: vi.fn(),
  authorizeStateChange: vi.fn(),
  markNotificationNoticeRead: vi.fn(),
}));

vi.mock("@/config/auth", () => ({ parseAuthConfig: mocks.parseAuthConfig }));
vi.mock("@/lib/auth", () => ({
  authenticateRequest: mocks.authenticateRequest,
  authorizeStateChange: mocks.authorizeStateChange,
}));
vi.mock("@/services/notifications", () => ({
  markNotificationNoticeRead: mocks.markNotificationNoticeRead,
}));

import { POST } from "./route";

describe("/api/notices/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
    mocks.authenticateRequest.mockResolvedValue({
      actor: { kind: "user", userId: "synthetic-user-a" },
      sessionId: "synthetic-session-a",
      transport: "bearer",
    });
    mocks.authorizeStateChange.mockReturnValue(true);
    mocks.markNotificationNoticeRead.mockResolvedValue(true);
  });

  it("本人IDをサービス境界へ固定して既読化する", async () => {
    const response = await POST(
      new Request("https://subbuddy.example/api/notices/synthetic-notice-a/read", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "synthetic-notice-a" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.markNotificationNoticeRead).toHaveBeenCalledWith(
      "synthetic-user-a",
      "synthetic-notice-a",
    );
  });

  it("別利用者のものを含む存在しないお知らせは404にする", async () => {
    mocks.markNotificationNoticeRead.mockResolvedValue(false);
    const response = await POST(
      new Request("https://subbuddy.example/api/notices/synthetic-notice-b/read", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "synthetic-notice-b" }) },
    );

    expect(response.status).toBe(404);
  });
});
