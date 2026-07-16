import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  rotateAuthSession: vi.fn(),
}));

vi.mock("@/config/auth", () => ({
  parseAuthConfig: mocks.parseAuthConfig,
}));

vi.mock("@/services/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/auth")>()),
  rotateAuthSession: mocks.rotateAuthSession,
}));

import { AppleOutageError, RefreshSessionError } from "@/services/auth";
import { POST } from "./route";

function request() {
  return new Request("https://testflight.subbuddy.example/api/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: "synthetic-refresh-token-with-enough-entropy" }),
  });
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
  });

  it("Apple障害の猶予期間終了時はsession保持のため503を返す", async () => {
    mocks.rotateAuthSession.mockRejectedValue(new AppleOutageError());

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "service unavailable" });
  });

  it("通常の無効なrefresh tokenは401を返す", async () => {
    mocks.rotateAuthSession.mockRejectedValue(new RefreshSessionError());

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});
