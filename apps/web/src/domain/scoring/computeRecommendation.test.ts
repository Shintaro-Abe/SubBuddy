import { describe, expect, it } from "vitest";
import { Decision, DataStatus } from "@prisma/client";
import { computeRecommendation, type RecommendationInput } from "./computeRecommendation";
import { defaultScoringConfig, scoringConfigSchema } from "@/config/scoring";

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    amount: 1000,
    billingCycle: "monthly",
    importance: 3,
    observationDays: 90,
    daysSinceLastUse: 0,
    hasUsageData: true,
    daysUntilRenewal: 20,
    hasCategoryOverlap: false,
    usageType: "active_foreground",
    usageDaysInSpan: 20,
    judgmentSpanDays: 30,
    contractMonths: 3,
    cumulativeSpend: 3000,
    cheaperPlan: null,
    cheaperAlternative: null,
    cheapestInCategory: null,
    initialValueAnswer: null,
    ...overrides,
  };
}

const cfg = defaultScoringConfig;

describe("P1：使っていない（方式C＝スパン＋最終利用）", () => {
  it("スパン内利用0日＋最終利用61日以上 → strong_cancel_candidate", () => {
    const r = computeRecommendation(input({
      usageDaysInSpan: 0,
      daysSinceLastUse: 90,
    }), cfg);
    expect(r.decision).toBe(Decision.strong_cancel_candidate);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(true);
    expect(r.reason).toContain("90日前");
  });

  it("スパン内利用0日＋最終利用31〜60日 → review（様子見）", () => {
    const r = computeRecommendation(input({
      usageDaysInSpan: 0,
      daysSinceLastUse: 45,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(true);
    expect(r.decision).toBe(Decision.review);
  });

  it("スパン内利用あり＋最終利用61日以上 → review", () => {
    const r = computeRecommendation(input({
      usageDaysInSpan: 2,
      daysSinceLastUse: 75,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(true);
    expect(r.decision).toBe(Decision.review);
  });

  it("スパン内利用あり＋最終利用30日以内 → P1 非該当 → keep", () => {
    const r = computeRecommendation(input({
      usageDaysInSpan: 20,
      daysSinceLastUse: 3,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(false);
    expect(r.decision).toBe(Decision.keep);
  });

  it("利用記録なし（hasUsageData=false）→ P1 適用不可", () => {
    const r = computeRecommendation(input({
      hasUsageData: false,
      usageDaysInSpan: 0,
      daysSinceLastUse: null,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(false);
  });

  it("年額契約の確定申告ソフト（年間スパン内に利用3日・最終300日前）→ P1 非該当", () => {
    const r = computeRecommendation(input({
      billingCycle: "yearly",
      usageDaysInSpan: 3,
      judgmentSpanDays: 365,
      daysSinceLastUse: 300,
      observationDays: 400,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(false);
  });
});

describe("P1：usage_type 別の適用可否", () => {
  it("passive → P1 適用不可", () => {
    const r = computeRecommendation(input({
      usageType: "passive",
      usageDaysInSpan: 0,
      daysSinceLastUse: 90,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(false);
  });

  it("entitlement → P1 適用不可", () => {
    const r = computeRecommendation(input({
      usageType: "entitlement",
      usageDaysInSpan: 0,
      daysSinceLastUse: 90,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(false);
  });

  it("active_background → P1 該当時に caveat あり", () => {
    const r = computeRecommendation(input({
      usageType: "active_background",
      usageDaysInSpan: 0,
      daysSinceLastUse: 90,
    }), cfg);
    const p1 = r.matchedPatterns.find((p) => p.pattern === "P1");
    expect(p1).toBeDefined();
    expect(p1!.caveat).toContain("背景再生");
  });

  it("active_other_device → P1 適用不可", () => {
    const r = computeRecommendation(input({
      usageType: "active_other_device",
      usageDaysInSpan: 0,
      daysSinceLastUse: 90,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P1")).toBe(false);
  });
});

describe("P2：重複で割高", () => {
  it("同カテゴリに安いサービスがある → P2 該当", () => {
    const r = computeRecommendation(input({
      hasCategoryOverlap: true,
      cheapestInCategory: 500,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P2")).toBe(true);
    expect(r.decision).toBe(Decision.consider_cancel);
  });

  it("同カテゴリで最安 → P2 非該当", () => {
    const r = computeRecommendation(input({
      hasCategoryOverlap: true,
      cheapestInCategory: 1000,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P2")).toBe(false);
  });
});

describe("P3：安いプランがある", () => {
  it("安い有料プランがある → P3 該当 → consider_downgrade", () => {
    const r = computeRecommendation(input({
      cheaperPlan: { name: "広告つき", monthlyPrice: 500 },
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P3")).toBe(true);
    expect(r.decision).toBe(Decision.consider_downgrade);
    expect(r.annualSavingsIfDowngraded).toBe(6000);
  });
});

describe("P4：安い競合がある", () => {
  it("安い有料競合がある → P4 該当 → consider_cancel", () => {
    const r = computeRecommendation(input({
      cheaperAlternative: { name: "安い競合", monthlyPrice: 300 },
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P4")).toBe(true);
    expect(r.decision).toBe(Decision.consider_cancel);
  });
});

describe("P5：更新が近い", () => {
  it("年額＋更新7日以内 → P5 該当", () => {
    const r = computeRecommendation(input({
      billingCycle: "yearly",
      amount: 12000,
      daysUntilRenewal: 5,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P5")).toBe(true);
    expect(r.reason).toContain("残り5日");
  });

  it("月額契約 → P5 非該当", () => {
    const r = computeRecommendation(input({
      daysUntilRenewal: 3,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P5")).toBe(false);
  });
});

describe("P6：高額で長期継続", () => {
  it("月額¥2,000以上＋12ヶ月以上 → P6 該当", () => {
    const r = computeRecommendation(input({
      amount: 3000,
      contractMonths: 18,
      cumulativeSpend: 54000,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P6")).toBe(true);
    expect(r.reason).toContain("18ヶ月");
  });

  it("月額¥1,500 → P6 非該当", () => {
    const r = computeRecommendation(input({
      amount: 1500,
      contractMonths: 24,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P6")).toBe(false);
  });
});

describe("P7：該当なし → keep", () => {
  it("どのパターンにも該当しない → keep", () => {
    const r = computeRecommendation(input(), cfg);
    expect(r.decision).toBe(Decision.keep);
    expect(r.matchedPatterns).toHaveLength(0);
    expect(r.reason).toContain("継続");
  });
});

describe("複数パターン該当時の Decision 優先度", () => {
  it("P1（解約検討）＋ P3（ダウングレード）→ 最も強い strong_cancel_candidate", () => {
    const r = computeRecommendation(input({
      usageDaysInSpan: 0,
      daysSinceLastUse: 90,
      cheaperPlan: { name: "安いプラン", monthlyPrice: 500 },
    }), cfg);
    expect(r.decision).toBe(Decision.strong_cancel_candidate);
    expect(r.matchedPatterns.length).toBeGreaterThanOrEqual(2);
  });
});

describe("観測中の即時パターン判定", () => {
  it("観測中でも P2〜P6 は判定され、decision が確定する", () => {
    const r = computeRecommendation(input({
      observationDays: 3,
      hasCategoryOverlap: true,
      cheapestInCategory: 500,
    }), cfg);
    expect(r.dataStatus).toBe(DataStatus.observing);
    expect(r.matchedPatterns.some((p) => p.pattern === "P2")).toBe(true);
    expect(r.decision).toBe(Decision.consider_cancel);
  });

  it("登録直後・利用データなしでも観測中になる（functional-design §8.5）", () => {
    const r = computeRecommendation(input({
      observationDays: 3,
      hasUsageData: false,
      usageDaysInSpan: 0,
      daysSinceLastUse: null,
    }), cfg);
    expect(r.dataStatus).toBe(DataStatus.observing);
    expect(r.daysUntilReady).toBe(cfg.minObservationDays - 3);
    expect(r.decision).toBeNull();
    expect(r.reason).toContain("観測中");
  });

  it("受動利用（passive）は登録直後でも観測中にならず即時確定する（§8.5）", () => {
    const r = computeRecommendation(input({
      observationDays: 3,
      usageType: "passive",
      hasUsageData: false,
      usageDaysInSpan: 0,
      daysSinceLastUse: null,
    }), cfg);
    expect(r.dataStatus).toBe(DataStatus.ready);
    expect(r.decision).toBe(Decision.keep);
  });
});

describe("年間節約額", () => {
  it("annualSavingsIfCancelled = 年額", () => {
    const r = computeRecommendation(input({ amount: 1500 }), cfg);
    expect(r.annualSavingsIfCancelled).toBe(18000);
  });

  it("annualSavingsIfDowngraded は P3 該当時のみ", () => {
    const noP3 = computeRecommendation(input(), cfg);
    expect(noP3.annualSavingsIfDowngraded).toBeNull();

    const withP3 = computeRecommendation(input({
      cheaperPlan: { name: "安いプラン", monthlyPrice: 500 },
    }), cfg);
    expect(withP3.annualSavingsIfDowngraded).toBe(6000);
  });
});

describe("config 差し替え", () => {
  it("p1CancelLastUseDays を下げると strong_cancel になりやすい", () => {
    const loose = scoringConfigSchema.parse({ p1CancelLastUseDays: 30 });
    const r = computeRecommendation(input({
      usageDaysInSpan: 0,
      daysSinceLastUse: 35,
    }), loose);
    expect(r.decision).toBe(Decision.strong_cancel_candidate);
  });
});

describe("RE-8.4：知識ベース陳腐化", () => {
  it("cheaperPlan の料金が陳腐化で補正されていても P3 は該当する", () => {
    const r = computeRecommendation(input({
      amount: 1500,
      cheaperPlan: { name: "旧プラン", monthlyPrice: 700 },
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P3")).toBe(true);
    expect(r.annualSavingsIfDowngraded).toBe(9600);
  });

  it("陳腐化で補正された料金が自分より高くなると P3 非該当", () => {
    const r = computeRecommendation(input({
      amount: 1000,
      cheaperPlan: { name: "旧プラン", monthlyPrice: 1000 },
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P3")).toBe(false);
  });
});

describe("RE-8.5：無料プラン除外", () => {
  it("cheaperPlan が null なら P3 非該当（無料プランしかないケース）", () => {
    const r = computeRecommendation(input({
      cheaperPlan: null,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P3")).toBe(false);
  });

  it("cheaperAlternative が null なら P4 非該当", () => {
    const r = computeRecommendation(input({
      cheaperAlternative: null,
    }), cfg);
    expect(r.matchedPatterns.some((p) => p.pattern === "P4")).toBe(false);
  });
});
