import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  parseNotificationConfig: vi.fn(),
  authenticateRequest: vi.fn(),
  authorizeStateChange: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

vi.mock("@/config/auth", () => ({ parseAuthConfig: mocks.parseAuthConfig }));
vi.mock("@/config/notifications", () => ({
  parseNotificationConfig: mocks.parseNotificationConfig,
}));
vi.mock("@/lib/auth", () => ({
  authenticateRequest: mocks.authenticateRequest,
  authorizeStateChange: mocks.authorizeStateChange,
}));
vi.mock("@/services/notifications", () => ({
  getNotificationPreferences: mocks.getNotificationPreferences,
  updateNotificationPreferences: mocks.updateNotificationPreferences,
}));

import { GET, PATCH } from "./route";

const preferences = {
  yearlyRenewalEnabled: false,
  monthlyRenewalEnabled: false,
  syncFailureEnabled: false,
  newSignInPushEnabled: true,
  promptDismissedAt: null,
};

describe("/api/notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
    mocks.parseNotificationConfig.mockReturnValue({ enabled: true });
    mocks.authenticateRequest.mockResolvedValue({
      actor: { kind: "user", userId: "synthetic-user-a" },
      sessionId: "synthetic-session-a",
      transport: "bearer",
    });
    mocks.authorizeStateChange.mockReturnValue(true);
    mocks.getNotificationPreferences.mockResolvedValue(preferences);
    mocks.updateNotificationPreferences.mockResolvedValue({
      ...preferences,
      yearlyRenewalEnabled: true,
    });
  });

  it("本人の通知希望と機能状態だけを返す", async () => {
    const response = await GET(
      new Request("https://subbuddy.example/api/notification-preferences"),
    );

    expect(response.status).toBe(200);
    expect(mocks.getNotificationPreferences).toHaveBeenCalledWith("synthetic-user-a");
  });

  it("未知キーと利用者IDを拒否する", async () => {
    const response = await PATCH(
      new Request("https://subbuddy.example/api/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          yearlyRenewalEnabled: true,
          userId: "synthetic-user-b",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it("機能フラグ無効時は変更を拒否する", async () => {
    mocks.parseNotificationConfig.mockReturnValue({ enabled: false });
    const response = await PATCH(
      new Request("https://subbuddy.example/api/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ yearlyRenewalEnabled: true }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
