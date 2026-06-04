import { describe, expect, it } from "vitest";
import { defaultScoringConfig, scoringConfigSchema } from "./scoring";

describe("scoringConfigSchema", () => {
  it("既定値を補完する（minObservationDays=14 等）", () => {
    expect(defaultScoringConfig.minObservationDays).toBe(14);
    expect(defaultScoringConfig.strongCancelUnusedDays).toBe(60);
    expect(defaultScoringConfig.considerCancelUnusedDays).toBe(30);
    expect(defaultScoringConfig.considerCancelMinAmount).toBe(1000);
  });

  it("差し替え値を受理する", () => {
    const c = scoringConfigSchema.parse({ minObservationDays: 7, lowUsageMaxDays: 3 });
    expect(c.minObservationDays).toBe(7);
    expect(c.lowUsageMaxDays).toBe(3);
  });

  it("considerCancelUnusedDays > strongCancelUnusedDays を拒否", () => {
    expect(
      scoringConfigSchema.safeParse({ considerCancelUnusedDays: 90, strongCancelUnusedDays: 60 })
        .success,
    ).toBe(false);
  });

  it("小数・範囲外を拒否", () => {
    expect(scoringConfigSchema.safeParse({ minObservationDays: 1.5 }).success).toBe(false);
    expect(scoringConfigSchema.safeParse({ highImportanceMin: 6 }).success).toBe(false);
  });
});
