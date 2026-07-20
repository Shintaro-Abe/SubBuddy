import { describe, expect, it } from "vitest";
import { resolveGuidanceProgress } from "@/services/guidance-progress";

const completeRecord = {
  inventoryCompletedAt: new Date("2026-07-20T00:00:00.000Z"),
  spendingViewedAt: new Date("2026-07-20T00:01:00.000Z"),
  reviewViewedAt: new Date("2026-07-20T00:02:00.000Z"),
  measurementChoice: "skipped" as const,
  completedAt: new Date("2026-07-20T00:03:00.000Z"),
};

describe("resolveGuidanceProgress", () => {
  it("進捗行がなくても安全な未完了状態を返す", () => {
    expect(resolveGuidanceProgress(0, null)).toEqual({
      steps: { inventory: false, spending: false, review: false, measurement: false },
      completedCount: 0,
      totalCount: 4,
      nextStep: "inventory",
      isComplete: false,
      measurementChoice: "pending",
    });
  });

  it("契約がなければ過去に完了していても棚卸しを次に案内する", () => {
    const resolved = resolveGuidanceProgress(0, completeRecord);
    expect(resolved.steps.inventory).toBe(false);
    expect(resolved.nextStep).toBe("inventory");
    expect(resolved.isComplete).toBe(false);
  });

  it("契約があり4段階を満たせば完了する", () => {
    const resolved = resolveGuidanceProgress(1, completeRecord);
    expect(resolved.completedCount).toBe(4);
    expect(resolved.nextStep).toBeNull();
    expect(resolved.isComplete).toBe(true);
  });

  it("Screen Timeを見送っても利用状況の段階を完了する", () => {
    const resolved = resolveGuidanceProgress(1, {
      ...completeRecord,
      reviewViewedAt: null,
      completedAt: null,
    });
    expect(resolved.steps.measurement).toBe(true);
    expect(resolved.nextStep).toBe("review");
  });
});
