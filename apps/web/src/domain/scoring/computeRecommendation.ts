import { Decision, DataStatus } from "@prisma/client";
import { toMonthlyAmount, toYearlyAmount, type BillingCycle } from "@/lib/money";
import { type ScoringConfig } from "@/config/scoring";
import { buildReason, reasonObserving } from "./reasons";

/**
 * パターン判定方式のレコメンドエンジン（純関数・副作用なし）。
 * steering: .steering/20260609-quantitative-recommendation-engine/
 *
 * P1〜P6 の具体的な状況パターンを個別に判定し、該当するものをすべて返す。
 * usage_type に応じて P1 の適用可否を切り替える。
 */

// ---- 型定義 ----

export type UsageType =
  | "active_foreground"
  | "active_background"
  | "active_other_device"
  | "passive"
  | "entitlement"
  | "capacity";

export type InitialValueAnswer = "very_important" | "somewhat" | "not_much";

export interface CheaperOption {
  name: string;
  monthlyPrice: number;
}

export interface MatchedPattern {
  pattern: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  label: string;
  evidence: string;
  caveat?: string;
}

export interface RecommendationInput {
  amount: number;
  billingCycle: BillingCycle;
  importance: number;
  observationDays: number;
  hasUsageData: boolean;
  daysSinceLastUse: number | null;
  daysUntilRenewal: number | null;
  hasCategoryOverlap: boolean;

  usageType: UsageType;
  usageDaysInSpan: number;
  judgmentSpanDays: number;
  contractMonths: number;
  cumulativeSpend: number;
  cheaperPlan: CheaperOption | null;
  cheaperAlternative: CheaperOption | null;
  cheapestInCategory: number | null;
  initialValueAnswer: InitialValueAnswer | null;
}

export interface RecommendationResult {
  decision: Decision | null;
  dataStatus: DataStatus;
  observationDays: number;
  daysUntilReady: number;
  matchedPatterns: MatchedPattern[];
  annualSavingsIfCancelled: number;
  annualSavingsIfDowngraded: number | null;
  monthlyAmount: number;
  yearlyAmount: number;
  daysSinceLastUse: number | null;
  daysUntilRenewal: number | null;
  hasOverlap: boolean;
  confidence: number;
  reason: string;
}

// ---- 実装 ----

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeRecommendation(
  input: RecommendationInput,
  config: ScoringConfig,
): RecommendationResult {
  const monthlyAmount = toMonthlyAmount(input.amount, input.billingCycle);
  const yearlyAmount = toYearlyAmount(input.amount, input.billingCycle);

  const renewalSoon =
    input.daysUntilRenewal !== null && input.daysUntilRenewal <= config.renewalSoonDays;

  const base = {
    observationDays: input.observationDays,
    monthlyAmount,
    yearlyAmount,
    daysSinceLastUse: input.daysSinceLastUse,
    daysUntilRenewal: input.daysUntilRenewal,
    hasOverlap: input.hasCategoryOverlap,
  };

  // --- 観測中（P1 の利用判定は保留。P2〜P6 は即時判定可能） ---
  if (
    canApplyP1(input.usageType) &&
    input.hasUsageData &&
    input.observationDays < config.minObservationDays
  ) {
    const daysUntilReady = config.minObservationDays - input.observationDays;
    const confidence = clamp(
      Math.round((input.observationDays / config.minObservationDays) * 100) / 100,
      0.1,
      0.99,
    );

    const immediatePatterns = matchPatternsP2toP6(input, config, monthlyAmount, yearlyAmount);

    return {
      ...base,
      decision: immediatePatterns.length > 0 ? determineDecision(immediatePatterns, input, config) : null,
      dataStatus: DataStatus.observing,
      daysUntilReady,
      matchedPatterns: immediatePatterns,
      annualSavingsIfCancelled: yearlyAmount,
      annualSavingsIfDowngraded: calcDowngradeSavings(input.cheaperPlan, monthlyAmount),
      confidence,
      reason: immediatePatterns.length > 0
        ? buildReason(immediatePatterns)
        : reasonObserving(daysUntilReady, {
            hasCategoryOverlap: input.hasCategoryOverlap,
            renewalSoon,
            daysUntilRenewal: input.daysUntilRenewal,
          }),
    };
  }

  // --- 確定（全パターン判定） ---
  const patterns = matchAllPatterns(input, config, monthlyAmount, yearlyAmount);
  const decision = patterns.length > 0
    ? determineDecision(patterns, input, config)
    : Decision.keep;

  return {
    ...base,
    decision,
    dataStatus: DataStatus.ready,
    daysUntilReady: 0,
    matchedPatterns: patterns,
    annualSavingsIfCancelled: yearlyAmount,
    annualSavingsIfDowngraded: calcDowngradeSavings(input.cheaperPlan, monthlyAmount),
    confidence: patterns.length > 0 ? 1.0 : 0.5,
    reason: buildReason(patterns),
  };
}

// ---- パターン判定 ----

function canApplyP1(usageType: UsageType): boolean {
  return usageType === "active_foreground" || usageType === "active_background";
}

function matchAllPatterns(
  input: RecommendationInput,
  config: ScoringConfig,
  monthlyAmount: number,
  yearlyAmount: number,
): MatchedPattern[] {
  const patterns: MatchedPattern[] = [];

  // P1
  const p1 = matchP1(input, config);
  if (p1) patterns.push(p1);

  // P2〜P6
  patterns.push(...matchPatternsP2toP6(input, config, monthlyAmount, yearlyAmount));

  return patterns;
}

function matchP1(input: RecommendationInput, config: ScoringConfig): MatchedPattern | null {
  if (!canApplyP1(input.usageType) || !input.hasUsageData) return null;

  const lastUseDays = input.daysSinceLastUse ?? input.observationDays;
  const spanDays = input.usageDaysInSpan;
  const caveat = input.usageType === "active_background"
    ? "背景再生は計測外です"
    : undefined;

  if (spanDays === 0 && lastUseDays >= config.p1CancelLastUseDays) {
    return {
      pattern: "P1",
      label: "使っていない",
      evidence: `最後に使ったのは${lastUseDays}日前です。直近${input.judgmentSpanDays}日間の利用が0日です`,
      caveat,
    };
  }

  if (spanDays === 0 && lastUseDays >= config.p1WatchLastUseDays) {
    return {
      pattern: "P1",
      label: "使っていない",
      evidence: `最後に使ったのは${lastUseDays}日前です`,
      caveat,
    };
  }

  if (spanDays >= 1 && lastUseDays >= config.p1CancelLastUseDays && input.judgmentSpanDays <= 30) {
    // 月額契約でスパン内利用あり＋最終利用が古い → 様子見
    // 年額契約ではスパン内に利用がある時点で「使っている」とみなす（年1回利用のサービスを救う）
    return {
      pattern: "P1",
      label: "使っていない",
      evidence: `直近${input.judgmentSpanDays}日間に利用がありますが、最後に使ったのは${lastUseDays}日前です`,
      caveat,
    };
  }

  return null;
}

function matchPatternsP2toP6(
  input: RecommendationInput,
  config: ScoringConfig,
  monthlyAmount: number,
  yearlyAmount: number,
): MatchedPattern[] {
  const patterns: MatchedPattern[] = [];

  // P2
  if (input.hasCategoryOverlap && input.cheapestInCategory !== null) {
    if (monthlyAmount > input.cheapestInCategory) {
      patterns.push({
        pattern: "P2",
        label: "重複で割高",
        evidence: `同カテゴリに¥${input.cheapestInCategory.toLocaleString()}/月のサービスがあります`,
      });
    }
  }

  // P3
  if (input.cheaperPlan) {
    const saving = monthlyAmount - input.cheaperPlan.monthlyPrice;
    if (saving > 0) {
      patterns.push({
        pattern: "P3",
        label: "安いプランがある",
        evidence: `${input.cheaperPlan.name}（¥${input.cheaperPlan.monthlyPrice.toLocaleString()}/月）に変更できます`,
      });
    }
  }

  // P4
  if (input.cheaperAlternative) {
    const saving = monthlyAmount - input.cheaperAlternative.monthlyPrice;
    if (saving > 0) {
      patterns.push({
        pattern: "P4",
        label: "安い競合がある",
        evidence: `${input.cheaperAlternative.name}（¥${input.cheaperAlternative.monthlyPrice.toLocaleString()}/月）があります`,
      });
    }
  }

  // P5
  if (
    input.billingCycle === "yearly" &&
    input.daysUntilRenewal !== null &&
    input.daysUntilRenewal <= config.renewalSoonDays
  ) {
    patterns.push({
      pattern: "P5",
      label: "更新が近い",
      evidence: `年額更新まで残り${input.daysUntilRenewal}日（更新額¥${yearlyAmount.toLocaleString()}）`,
    });
  }

  // P6
  if (
    monthlyAmount >= config.highCostThreshold &&
    input.contractMonths >= config.longContractMonths
  ) {
    patterns.push({
      pattern: "P6",
      label: "高額で長期継続",
      evidence: `${input.contractMonths}ヶ月継続中（累計¥${input.cumulativeSpend.toLocaleString()}）`,
    });
  }

  return patterns;
}

// ---- Decision 決定 ----

function determineDecision(
  patterns: MatchedPattern[],
  input: RecommendationInput,
  config: ScoringConfig,
): Decision {
  const hasP1 = patterns.some((p) => p.pattern === "P1");
  const hasP2 = patterns.some((p) => p.pattern === "P2");
  const hasP4 = patterns.some((p) => p.pattern === "P4");
  const hasP3 = patterns.some((p) => p.pattern === "P3");

  if (hasP1) {
    const lastUseDays = input.daysSinceLastUse ?? input.observationDays;
    if (input.usageDaysInSpan === 0 && lastUseDays >= config.p1CancelLastUseDays) {
      return Decision.strong_cancel_candidate;
    }
    return Decision.review;
  }

  if (hasP2 || hasP4) return Decision.consider_cancel;
  if (hasP3) return Decision.consider_downgrade;

  return Decision.review;
}

// ---- ヘルパー ----

function calcDowngradeSavings(
  cheaperPlan: CheaperOption | null,
  monthlyAmount: number,
): number | null {
  if (!cheaperPlan) return null;
  const saving = monthlyAmount - cheaperPlan.monthlyPrice;
  return saving > 0 ? saving * 12 : null;
}
