import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  authenticateRequest: vi.fn(),
  authorizeStateChange: vi.fn(),
  getResolvedGuidanceProgress: vi.fn(),
  recordGuidanceEvent: vi.fn(),
}));

vi.mock("@/config/auth", () => ({ parseAuthConfig: mocks.parseAuthConfig }));
vi.mock("@/lib/auth", () => ({
  authenticateRequest: mocks.authenticateRequest,
  authorizeStateChange: mocks.authorizeStateChange,
}));
vi.mock("@/services/guidance-progress", () => ({
  getResolvedGuidanceProgress: mocks.getResolvedGuidanceProgress,
  recordGuidanceEvent: mocks.recordGuidanceEvent,
}));

import { GET, PATCH } from "./route";

const progress = {
  steps: { inventory: true, spending: false, review: false, measurement: false },
  completedCount: 1,
  totalCount: 4,
  nextStep: "spending",
  isComplete: false,
  measurementChoice: "pending",
};

describe("/api/guidance-progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
    mocks.authenticateRequest.mockResolvedValue({
      actor: { kind: "user", userId: "synthetic-user-a" },
      sessionId: "synthetic-session-a",
      transport: "bearer",
    });
    mocks.authorizeStateChange.mockReturnValue(true);
    mocks.getResolvedGuidanceProgress.mockResolvedValue(progress);
    mocks.recordGuidanceEvent.mockResolvedValue(progress);
  });

  it("本人の進捗だけを取得する", async () => {
    const response = await GET(new Request("https://subbuddy.example/api/guidance-progress"));
    expect(response.status).toBe(200);
    expect(mocks.getResolvedGuidanceProgress).toHaveBeenCalledWith("synthetic-user-a");
  });

  it("固定イベントを本人の進捗へ記録する", async () => {
    const response = await PATCH(
      new Request("https://subbuddy.example/api/guidance-progress", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "review_viewed" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.recordGuidanceEvent).toHaveBeenCalledWith("synthetic-user-a", "review_viewed");
  });

  it("利用者IDや任意項目を含む要求を拒否する", async () => {
    const response = await PATCH(
      new Request("https://subbuddy.example/api/guidance-progress", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "review_viewed", userId: "synthetic-user-b" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.recordGuidanceEvent).not.toHaveBeenCalled();
  });

  it("未認証要求を拒否する", async () => {
    mocks.authenticateRequest.mockResolvedValue(null);
    const response = await GET(new Request("https://subbuddy.example/api/guidance-progress"));
    expect(response.status).toBe(401);
  });
});
