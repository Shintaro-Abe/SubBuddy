import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  listActiveSessions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authenticateRequest: mocks.authenticateRequest,
  authorizeStateChange: vi.fn(),
}));
vi.mock("@/services/auth", () => ({
  appleIdentityBelongsToUser: vi.fn(),
  listActiveSessions: mocks.listActiveSessions,
  revokeAllSessionsAndDevices: vi.fn(),
}));

import { GET } from "./route";

describe("GET /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateRequest.mockResolvedValue({
      actor: { kind: "user", userId: "synthetic-user-a", authProvider: "apple" },
      sessionId: "synthetic-session-current",
      transport: "cookie",
    });
    mocks.listActiveSessions.mockResolvedValue([
      {
        id: "synthetic-session-current",
        clientType: "web",
        deviceName: null,
        createdAt: new Date("2026-07-25T08:00:00.000Z"),
        lastUsedAt: new Date("2026-07-25T09:00:00.000Z"),
        current: true,
      },
      {
        id: "synthetic-session-ios",
        clientType: "ios",
        deviceName: "確認用iPhone",
        createdAt: new Date("2026-07-24T08:00:00.000Z"),
        lastUsedAt: new Date("2026-07-25T08:30:00.000Z"),
        current: false,
      },
    ]);
  });

  it("本人の有効セッションを現在の接続付きで返す", async () => {
    const response = await GET(
      new Request("https://subbuddy.example/api/sessions", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        { id: "synthetic-session-current", clientType: "web", current: true },
        { id: "synthetic-session-ios", clientType: "ios", current: false },
      ],
    });
    expect(mocks.listActiveSessions).toHaveBeenCalledWith(
      "synthetic-user-a",
      "synthetic-session-current",
    );
  });

  it("未認証の要求を拒否する", async () => {
    mocks.authenticateRequest.mockResolvedValue(null);

    const response = await GET(
      new Request("https://subbuddy.example/api/sessions", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.listActiveSessions).not.toHaveBeenCalled();
  });
});
