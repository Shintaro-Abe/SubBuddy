import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseAuthConfig: vi.fn(),
  authenticateRequest: vi.fn(),
  authorizeStateChange: vi.fn(),
  deleteMeasurementData: vi.fn(),
  recomputeRecommendations: vi.fn(),
}));

vi.mock("@/config/auth", () => ({ parseAuthConfig: mocks.parseAuthConfig }));
vi.mock("@/lib/auth", () => ({
  authenticateRequest: mocks.authenticateRequest,
  authorizeStateChange: mocks.authorizeStateChange,
}));
vi.mock("@/repositories/measurement-data", () => ({
  deleteMeasurementData: mocks.deleteMeasurementData,
}));
vi.mock("@/services/recompute", () => ({
  recomputeRecommendations: mocks.recomputeRecommendations,
}));

import { DELETE } from "./route";

const request = () =>
  new Request("https://subbuddy.example/api/subscriptions/synthetic-subscription/usage", {
    method: "DELETE",
  });
const context = () => ({ params: Promise.resolve({ id: "synthetic-subscription" }) });

describe("DELETE /api/subscriptions/:id/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseAuthConfig.mockReturnValue({ mode: "cloud-testflight" });
    mocks.authenticateRequest.mockResolvedValue({ actor: { userId: "synthetic-user" } });
    mocks.authorizeStateChange.mockReturnValue(true);
    mocks.deleteMeasurementData.mockResolvedValue({ usageCount: 2, recommendationCount: 1 });
    mocks.recomputeRecommendations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("所有契約の計測データを削除して利用量なしで再計算する", async () => {
    const response = await DELETE(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(mocks.deleteMeasurementData).toHaveBeenCalledWith(
      "synthetic-user",
      "synthetic-subscription",
    );
    expect(mocks.recomputeRecommendations).toHaveBeenCalledWith("synthetic-user");
  });

  it("所有しない契約は404にして再計算しない", async () => {
    mocks.deleteMeasurementData.mockResolvedValue(null);
    const response = await DELETE(request(), context());

    expect(response.status).toBe(404);
    expect(mocks.recomputeRecommendations).not.toHaveBeenCalled();
  });

  it("認証なしは401にする", async () => {
    mocks.authenticateRequest.mockResolvedValue(null);
    const response = await DELETE(request(), context());

    expect(response.status).toBe(401);
    expect(mocks.deleteMeasurementData).not.toHaveBeenCalled();
  });

  it("クラウド状態変更の検証失敗は403にする", async () => {
    mocks.authorizeStateChange.mockReturnValue(false);
    const response = await DELETE(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.deleteMeasurementData).not.toHaveBeenCalled();
  });

  it("再計算失敗は500になり、再実行可能なままにする", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("synthetic failure");
    mocks.recomputeRecommendations.mockRejectedValue(failure);
    const response = await DELETE(request(), context());

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "DELETE /api/subscriptions/[id]/usage failed",
      failure,
    );
  });
});
