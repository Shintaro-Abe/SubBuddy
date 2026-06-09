import { describe, expect, it } from "vitest";
import { defaultScoringConfig, scoringConfigSchema } from "./scoring";

describe("scoringConfigSchema", () => {
  it("既定値を補完する", () => {
    expect(defaultScoringConfig.minObservationDays).toBe(14);
    expect(defaultScoringConfig.p1WatchLastUseDays).toBe(31);
    expect(defaultScoringConfig.p1CancelLastUseDays).toBe(61);
    expect(defaultScoringConfig.renewalSoonDays).toBe(7);
    expect(defaultScoringConfig.highCostThreshold).toBe(2000);
    expect(defaultScoringConfig.longContractMonths).toBe(12);
    expect(defaultScoringConfig.knowledgeBaseStaleDays).toBe(180);
    expect(defaultScoringConfig.staleConfidenceMultiplier).toBe(0.7);
  });

  it("差し替え値を受理する", () => {
    const c = scoringConfigSchema.parse({ minObservationDays: 7, p1WatchLastUseDays: 15 });
    expect(c.minObservationDays).toBe(7);
    expect(c.p1WatchLastUseDays).toBe(15);
  });

  it("小数の日数を拒否", () => {
    expect(scoringConfigSchema.safeParse({ minObservationDays: 1.5 }).success).toBe(false);
  });

  it("staleConfidenceMultiplier が 0〜1 の範囲外を拒否", () => {
    expect(scoringConfigSchema.safeParse({ staleConfidenceMultiplier: 1.5 }).success).toBe(false);
    expect(scoringConfigSchema.safeParse({ staleConfidenceMultiplier: -0.1 }).success).toBe(false);
  });
});
