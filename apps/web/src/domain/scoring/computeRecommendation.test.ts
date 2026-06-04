import { describe, expect, it } from "vitest";
import { Decision, DataStatus } from "@prisma/client";
import { computeRecommendation, type RecommendationInput } from "./computeRecommendation";
import { defaultScoringConfig, scoringConfigSchema } from "@/config/scoring";

/** 十分利用・確定状態を既定にした入力ビルダー（keep 相当）。 */
function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    amount: 1000,
    billingCycle: "monthly",
    importance: 3,
    observationDays: 90,
    usageDays30d: 20,
    usageMinutes30d: 600,
    daysSinceLastUse: 0,
    daysUntilRenewal: 20,
    hasCategoryOverlap: false,
    isLowerUsageInOverlap: false,
    ...overrides,
  };
}

const cfg = defaultScoringConfig;

describe("computeRecommendation：段階的提供（観測中⇄確定）", () => {
  it("観測 < minObservationDays は observing・decision は null", () => {
    const r = computeRecommendation(input({ observationDays: 3 }), cfg);
    expect(r.dataStatus).toBe(DataStatus.observing);
    expect(r.decision).toBeNull();
    expect(r.daysUntilReady).toBe(11);
    expect(r.confidence).toBeLessThan(1);
    expect(r.reason).toContain("観測中");
  });

  it("境界：13日は observing、14日は ready", () => {
    expect(computeRecommendation(input({ observationDays: 13 }), cfg).dataStatus).toBe(
      DataStatus.observing,
    );
    const ready = computeRecommendation(input({ observationDays: 14 }), cfg);
    expect(ready.dataStatus).toBe(DataStatus.ready);
    expect(ready.daysUntilReady).toBe(0);
    expect(ready.confidence).toBe(1);
  });

  it("観測中でも更新間近・重複は即時に理由へ出る", () => {
    const r = computeRecommendation(
      input({ observationDays: 2, daysUntilRenewal: 5, hasCategoryOverlap: true }),
      cfg,
    );
    expect(r.reason).toContain("更新まで");
    expect(r.reason).toContain("他の契約");
    expect(r.hasOverlap).toBe(true);
  });
});

describe("computeRecommendation：確定後の判定ルール", () => {
  it("60日以上未使用 → strong_cancel_candidate", () => {
    const r = computeRecommendation(
      input({ daysSinceLastUse: 65, usageDays30d: 0, observationDays: 120 }),
      cfg,
    );
    expect(r.decision).toBe(Decision.strong_cancel_candidate);
    expect(r.reason).toContain("65 日間");
  });

  it("一度も未使用でも観測十分なら観測日数を未使用日数とみなす", () => {
    const r = computeRecommendation(
      input({ daysSinceLastUse: null, usageDays30d: 0, observationDays: 70 }),
      cfg,
    );
    expect(r.decision).toBe(Decision.strong_cancel_candidate);
  });

  it("30日以上未使用 × 月1,000円超 → consider_cancel", () => {
    const r = computeRecommendation(
      input({ amount: 1480, daysSinceLastUse: 35, usageDays30d: 0, observationDays: 90 }),
      cfg,
    );
    expect(r.decision).toBe(Decision.consider_cancel);
  });

  it("30日以上未使用でも割安（1,000円未満）なら strong/consider に落ちない", () => {
    const r = computeRecommendation(
      input({ amount: 400, daysSinceLastUse: 35, usageDays30d: 0, observationDays: 90, importance: 3 }),
      cfg,
    );
    expect(r.decision).not.toBe(Decision.consider_cancel);
    expect(r.decision).not.toBe(Decision.strong_cancel_candidate);
  });

  it("同カテゴリ重複の低利用側 → consider_cancel", () => {
    const r = computeRecommendation(
      input({
        daysSinceLastUse: 6,
        usageDays30d: 2,
        observationDays: 180,
        hasCategoryOverlap: true,
        isLowerUsageInOverlap: true,
        importance: 2,
      }),
      cfg,
    );
    expect(r.decision).toBe(Decision.consider_cancel);
  });

  it("低利用 × 重要度高 → review（様子見）", () => {
    const r = computeRecommendation(
      input({ usageDays30d: 3, importance: 5, daysSinceLastUse: 4, observationDays: 75 }),
      cfg,
    );
    expect(r.decision).toBe(Decision.review);
    expect(r.reason).toContain("様子見");
  });

  it("十分利用 → keep", () => {
    const r = computeRecommendation(
      input({ usageDays30d: 26, daysSinceLastUse: 0, observationDays: 150 }),
      cfg,
    );
    expect(r.decision).toBe(Decision.keep);
  });
});

describe("computeRecommendation：単価・スコア・config 差し替え", () => {
  it("cost_per_usage_day = 月額換算 ÷ 利用日数（0日は null）", () => {
    const used = computeRecommendation(input({ amount: 1000, usageDays30d: 10 }), cfg);
    expect(used.costPerUsageDay).toBe(100);
    const unused = computeRecommendation(input({ usageDays30d: 0, daysSinceLastUse: 10 }), cfg);
    expect(unused.costPerUsageDay).toBeNull();
  });

  it("年額契約も月額換算で評価する", () => {
    const r = computeRecommendation(input({ amount: 12000, billingCycle: "yearly" }), cfg);
    expect(r.monthlyAmount).toBe(1000);
    expect(r.yearlyAmount).toBe(12000);
  });

  it("cancelScore は keep より解約候補のほうが高い", () => {
    const keep = computeRecommendation(input({ usageDays30d: 26 }), cfg);
    const strong = computeRecommendation(
      input({ daysSinceLastUse: 90, usageDays30d: 0, observationDays: 120 }),
      cfg,
    );
    expect(strong.cancelScore).toBeGreaterThan(keep.cancelScore);
  });

  it("config 差し替えで判定が変わる（minObservationDays を下げると確定する）", () => {
    const loose = scoringConfigSchema.parse({ minObservationDays: 1 });
    const r = computeRecommendation(input({ observationDays: 3, usageDays30d: 25 }), loose);
    expect(r.dataStatus).toBe(DataStatus.ready);
    expect(r.decision).toBe(Decision.keep);
  });
});
