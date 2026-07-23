import {
  BillingCycle,
  DataStatus,
  Decision,
  type RecommendationSnapshot,
  type Subscription,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { REVIEW_PRIORITY_LABEL } from "./output";
import { validateReviewForDisplay } from "./validation";

const asOf = new Date("2026-07-23T12:00:00.000Z");
const updatedAt = new Date("2026-07-23T09:00:00.000Z");

const subscription = {
  id: "synthetic-subscription",
  userId: "synthetic-user",
  amount: 1_000,
  billingCycle: BillingCycle.monthly,
  updatedAt,
} as Subscription;

function snapshot(
  overrides: Partial<RecommendationSnapshot> = {},
): RecommendationSnapshot {
  return {
    id: "synthetic-review",
    userId: "synthetic-user",
    subscriptionId: subscription.id,
    decision: Decision.keep,
    dataStatus: DataStatus.ready,
    observationDays: 30,
    daysUntilReady: 0,
    cancelScore: 0,
    monthlyAmount: 1_000,
    yearlyAmount: 12_000,
    usageDays30d: 3,
    usageMinutes30d: 45,
    daysSinceLastUse: 2,
    daysUntilRenewal: 20,
    costPerUsageDay: 333.33,
    hasOverlap: false,
    confidence: 1,
    reason: "合成データの見直し材料です。",
    matchedPatterns: [],
    reviewPriority: "low_urgency",
    reviewUnknowns: [],
    reviewOptions: [
      {
        kind: "continue",
        title: "このまま利用する",
        detail: "合成データの選択肢です。",
      },
    ],
    annualSavingsIfCancelled: 12_000,
    annualSavingsIfDowngraded: null,
    annualSavingsIfSwitched: null,
    sourceSubscriptionUpdatedAt: updatedAt,
    generatedAt: asOf,
    ...overrides,
  };
}

describe("validateReviewForDisplay", () => {
  it("別ユーザーの契約を停止する", () => {
    expect(
      validateReviewForDisplay(
        "synthetic-user",
        snapshot(),
        { ...subscription, userId: "other-synthetic-user" },
        asOf,
      ),
    ).toEqual({ ok: false, code: "owner_mismatch" });
  });

  it("登録金額と異なる事実を停止する", () => {
    expect(
      validateReviewForDisplay(
        "synthetic-user",
        snapshot({ monthlyAmount: 900 }),
        subscription,
        asOf,
      ),
    ).toEqual({ ok: false, code: "fact_mismatch" });
  });

  it("90日を超えた候補を停止する", () => {
    const result = validateReviewForDisplay(
      "synthetic-user",
      snapshot({
        annualSavingsIfDowngraded: 3_600,
        reviewOptions: [
          {
            kind: "downgrade",
            title: "下位プランを確認する",
            detail: "合成候補です。",
            currentMonthlyAmount: 1_000,
            targetMonthlyAmount: 700,
            annualSavings: 3_600,
            sourceUrl: "https://example.com/synthetic",
            verifiedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
      }),
      subscription,
      asOf,
    );
    expect(result).toEqual({ ok: false, code: "catalog_stale" });
  });

  it("利用0日の根拠だけで今確認へ上げた結果を停止する", () => {
    const result = validateReviewForDisplay(
      "synthetic-user",
      snapshot({
        reviewPriority: "now",
        matchedPatterns: [
          {
            pattern: "P1",
            label: "最近の利用記録がない",
            evidence: "最近30日の利用記録が0日です",
          },
        ],
        reviewUnknowns: [
          {
            code: "usage_scope",
            message: "別端末の利用は記録されない場合があります。",
          },
        ],
      }),
      subscription,
      asOf,
    );
    expect(result).toEqual({ ok: false, code: "usage_only_priority" });
  });

  it("観測中なのに不足情報を隠した結果を停止する", () => {
    const result = validateReviewForDisplay(
      "synthetic-user",
      snapshot({
        dataStatus: DataStatus.observing,
        reviewPriority: "missing_information",
        reviewUnknowns: [],
      }),
      subscription,
      asOf,
    );
    expect(result).toEqual({ ok: false, code: "missing_unknown" });
  });

  it("非HTTPの候補情報源を停止する", () => {
    const result = validateReviewForDisplay(
      "synthetic-user",
      snapshot({
        annualSavingsIfSwitched: 3_600,
        reviewOptions: [
          {
            kind: "switch",
            title: "代替を確認する",
            detail: "合成候補です。",
            currentMonthlyAmount: 1_000,
            targetMonthlyAmount: 700,
            annualSavings: 3_600,
            sourceUrl: "javascript:alert(1)",
            verifiedAt: "2026-07-23T00:00:00.000Z",
          },
        ],
      }),
      subscription,
      asOf,
    );
    expect(result).toEqual({ ok: false, code: "unsafe_source" });
  });

  it("計算条件と一致しない節約額を停止する", () => {
    const result = validateReviewForDisplay(
      "synthetic-user",
      snapshot({
        annualSavingsIfDowngraded: 9_999,
        reviewOptions: [
          {
            kind: "downgrade",
            title: "下位プランを確認する",
            detail: "合成候補です。",
            currentMonthlyAmount: 1_000,
            targetMonthlyAmount: 700,
            annualSavings: 9_999,
            sourceUrl: "https://example.com/synthetic",
            verifiedAt: "2026-07-23T00:00:00.000Z",
          },
        ],
      }),
      subscription,
      asOf,
    );
    expect(result).toEqual({ ok: false, code: "savings_mismatch" });
  });

  it("低優先度を継続推奨と表現しない", () => {
    expect(REVIEW_PRIORITY_LABEL.low_urgency).not.toContain("継続");
    expect(
      validateReviewForDisplay("synthetic-user", snapshot(), subscription, asOf),
    ).toEqual({ ok: true });
  });

  it("契約編集後の古い結果を停止する", () => {
    expect(
      validateReviewForDisplay(
        "synthetic-user",
        snapshot({
          sourceSubscriptionUpdatedAt: new Date("2026-07-22T00:00:00.000Z"),
        }),
        subscription,
        asOf,
      ),
    ).toEqual({ ok: false, code: "subscription_changed" });
  });
});
