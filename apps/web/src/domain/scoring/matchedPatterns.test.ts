import { describe, expect, it } from "vitest";
import { parseMatchedPatterns } from "./matchedPatterns";
import { buildReason } from "./reasons";
import { computeRecommendation, type MatchedPattern, type RecommendationInput } from "./computeRecommendation";
import { defaultScoringConfig } from "@/config/scoring";

describe("parseMatchedPatterns", () => {
  it("正しい配列はそのまま往復する", () => {
    const input: MatchedPattern[] = [
      { pattern: "P1", label: "使っていない", evidence: "最後に使ったのは45日前です", caveat: "背景再生は計測外です" },
      { pattern: "P5", label: "更新が近い", evidence: "残り3日" },
    ];
    expect(parseMatchedPatterns(input)).toEqual(input);
  });

  it("後方互換：null / 非配列は空配列", () => {
    expect(parseMatchedPatterns(null)).toEqual([]);
    expect(parseMatchedPatterns(undefined)).toEqual([]);
    expect(parseMatchedPatterns("P1")).toEqual([]);
    expect(parseMatchedPatterns({ pattern: "P1" })).toEqual([]);
  });

  it("壊れた要素は除外し、正しい要素だけ残す（例外を投げない）", () => {
    const raw = [
      { pattern: "P2", label: "重複で割高", evidence: "他に安いのがある" }, // OK
      { pattern: "PX", label: "不正記号", evidence: "x" }, // pattern 不正
      { pattern: "P3", label: 123, evidence: "x" }, // label 型不正
      { pattern: "P4", label: "安い競合がある" }, // evidence 欠落
      null, // null 要素
      { pattern: "P6", label: "高額で長期継続", evidence: "12ヶ月", caveat: 5 }, // caveat 型不正
    ];
    const result = parseMatchedPatterns(raw);
    expect(result).toEqual([{ pattern: "P2", label: "重複で割高", evidence: "他に安いのがある" }]);
  });

  it("caveat 無しの要素は caveat キーを持たない", () => {
    const result = parseMatchedPatterns([{ pattern: "P5", label: "更新が近い", evidence: "残り3日" }]);
    expect(result[0]).not.toHaveProperty("caveat");
  });

  it("status（容量ゲート）を読み戻しで保持する", () => {
    const result = parseMatchedPatterns([
      { pattern: "P3", label: "安いプランがある", evidence: "確認を", status: "needs_capacity_check" },
    ]);
    expect(result[0].status).toBe("needs_capacity_check");
  });

  it("不正な status は除外する", () => {
    const result = parseMatchedPatterns([
      { pattern: "P3", label: "安いプランがある", evidence: "x", status: "bogus" },
    ]);
    expect(result).toEqual([]);
  });

  it("整合（ready 限定）：保存した matchedPatterns から buildReason すると保存 reason に一致する", () => {
    // 更新間近の年額契約 → ready で P5 が立つ
    const input: RecommendationInput = {
      amount: 12000,
      billingCycle: "yearly",
      importance: 3,
      observationDays: 60,
      hasUsageData: false,
      daysSinceLastUse: null,
      daysUntilRenewal: 3,
      hasCategoryOverlap: false,
      usageType: "passive",
      usageDaysInSpan: 0,
      judgmentSpanDays: 365,
      contractMonths: 12,
      cumulativeSpend: 12000,
      cheaperPlan: null,
      cheaperAlternative: null,
      cheapestInCategory: null,
      initialValueAnswer: null,
      usedCapacityGb: null,
      daysSinceCapacityCheck: null,
      cheaperPlanCandidates: [],
    };
    const result = computeRecommendation(input, defaultScoringConfig);
    expect(result.dataStatus).toBe("ready");
    // DB 往復を模して parse を通す
    const restored = parseMatchedPatterns(result.matchedPatterns);
    expect(buildReason(restored)).toBe(result.reason);
  });
});
