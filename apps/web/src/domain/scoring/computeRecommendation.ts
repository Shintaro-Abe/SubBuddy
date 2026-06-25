import { Decision, DataStatus } from "@prisma/client";
import { toMonthlyAmount, toYearlyAmount, type BillingCycle } from "@/lib/money";
import { type ScoringConfig } from "@/config/scoring";
import { smallestFittingPlan, type PlanCandidate } from "@/domain/capacity/fit";
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

// type エイリアスにすることで暗黙の索引シグネチャが付き、Prisma の Json 入力型
// （InputJsonValue）へキャストなしで保存できる（.steering/20260616-matched-patterns-persistence/design.md §2.1）。
export type P3Status = "confirmed" | "needs_capacity_check";

export type MatchedPattern = {
  pattern: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  label: string;
  evidence: string;
  caveat?: string;
  // P3（容量型 iCloud+）専用。confirmed=容量確認済みで安全に提案／needs_capacity_check=容量未確認や鮮度切れで保留。
  // 既定（非容量型）は付けない＝confirmed 相当。
  status?: P3Status;
};

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

  // 容量ゲート（iCloud+＝usageType "capacity"）用。非容量型では used=null・候補は空配列。
  usedCapacityGb: number | null;
  daysSinceCapacityCheck: number | null;
  cheaperPlanCandidates: PlanCandidate[]; // 自分より安い有料プラン（容量つき）
  // 現在の契約プラン容量(GB)。判定には使わず、確定提案の文言を具体化する表示用途のみ。
  planCapacityGb: number | null;
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

  // P3（安いプランがある）の解決。容量型(iCloud+)はここで容量ゲートを通す。
  const p3 = resolveP3(input, monthlyAmount, config);

  const base = {
    observationDays: input.observationDays,
    monthlyAmount,
    yearlyAmount,
    daysSinceLastUse: input.daysSinceLastUse,
    daysUntilRenewal: input.daysUntilRenewal,
    hasOverlap: input.hasCategoryOverlap,
  };

  // --- 観測中（P1 の利用判定は保留。P2〜P6 は即時判定可能） ---
  // 観測中かどうかは登録からの経過日数のみで決まる（design §「dataStatus は時間ベース」）。
  // 利用データの有無は P1 の適用可否（matchP1）にだけ影響する。
  if (
    canApplyP1(input.usageType) &&
    input.observationDays < config.minObservationDays
  ) {
    const daysUntilReady = config.minObservationDays - input.observationDays;
    const confidence = clamp(
      Math.round((input.observationDays / config.minObservationDays) * 100) / 100,
      0.1,
      0.99,
    );

    const immediatePatterns = matchPatternsP2toP6(input, config, monthlyAmount, yearlyAmount, p3);

    return {
      ...base,
      decision: immediatePatterns.length > 0 ? determineDecision(immediatePatterns, input, config) : null,
      dataStatus: DataStatus.observing,
      daysUntilReady,
      matchedPatterns: immediatePatterns,
      annualSavingsIfCancelled: yearlyAmount,
      annualSavingsIfDowngraded: calcDowngradeSavings(p3.savingsPlan, monthlyAmount),
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
  const patterns = matchAllPatterns(input, config, monthlyAmount, yearlyAmount, p3);
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
    annualSavingsIfDowngraded: calcDowngradeSavings(p3.savingsPlan, monthlyAmount),
    confidence: patterns.length > 0 ? 1.0 : 0.5,
    reason: buildReason(patterns),
  };
}

// ---- パターン判定 ----

function canApplyP1(usageType: UsageType): boolean {
  return usageType === "active_foreground" || usageType === "active_background";
}

// ---- P3（安いプランがある）の解決：容量型は容量ゲートを通す ----

interface ResolvedP3 {
  show: boolean;
  evidence: string;
  caveat?: string;
  status?: P3Status;
  savingsPlan: CheaperOption | null; // 確定提案時のみ非null（節約額の根拠）
}

const P3_HIDDEN: ResolvedP3 = { show: false, evidence: "", savingsPlan: null };

const CAPACITY_DOWNGRADE_CAVEAT =
  "変更後は同期・バックアップ・新規保存に影響する可能性があります。変更前に Apple の画面で確認してください";

// 容量(GB)を表示用ラベルに（1,000GB以上は TB 表記）。判定には使わない表示専用。
function formatCapacityLabel(gb: number): string {
  return gb >= 1000 ? `${gb / 1000}TB` : `${gb}GB`;
}

function resolveP3(
  input: RecommendationInput,
  monthlyAmount: number,
  config: ScoringConfig,
): ResolvedP3 {
  // 非容量型：従来どおり cheaperPlan があり安くなるなら表示（断定）。
  if (input.usageType !== "capacity") {
    const cp = input.cheaperPlan;
    if (cp && monthlyAmount - cp.monthlyPrice > 0) {
      return {
        show: true,
        evidence: `${cp.name}（¥${cp.monthlyPrice.toLocaleString()}/月）に変更できます`,
        savingsPlan: cp,
      };
    }
    return P3_HIDDEN;
  }

  // 容量型（iCloud+）：安い下位プラン候補が無ければ何も出さない。
  const candidates = input.cheaperPlanCandidates;
  if (candidates.length === 0) return P3_HIDDEN;

  // 使用容量が無い → 断定せず「容量確認を促す」。
  if (input.usedCapacityGb === null) {
    return {
      show: true,
      status: "needs_capacity_check",
      evidence: "もっと安い下位プランがあります。使用容量を確認すると、下げられるか判定できます",
      savingsPlan: null,
    };
  }

  // 使用容量はあるが鮮度切れ（確認日時不明 or しきい値超過）→ 再確認を促す。
  const fresh =
    input.daysSinceCapacityCheck !== null &&
    input.daysSinceCapacityCheck <= config.capacityFreshnessDays;
  if (!fresh) {
    return {
      show: true,
      status: "needs_capacity_check",
      evidence: "前回確認時点では足りそうでしたが、今の使用容量を再確認しましょう",
      savingsPlan: null,
    };
  }

  // 使用容量あり＋鮮度OK → 安全に収まる最小プランがあれば断定提案。
  const fit = smallestFittingPlan(input.usedCapacityGb, candidates, {
    bufferGb: config.capacitySafetyBufferGb,
    bufferRatio: config.capacitySafetyBufferRatio,
  });
  if (!fit) return P3_HIDDEN; // どの下位プランにも安全に収まらない → 提案しない

  // 現在の契約プランが分かれば「◯◯から」を添えて具体化する（判定には影響しない表示のみ）。
  const fromPlan =
    input.planCapacityGb !== null ? `${formatCapacityLabel(input.planCapacityGb)}から` : "";
  return {
    show: true,
    status: "confirmed",
    evidence: `現在の使用容量なら${fromPlan}${fit.name}（¥${fit.monthlyPrice.toLocaleString()}/月の目安）で足ります`,
    caveat: CAPACITY_DOWNGRADE_CAVEAT,
    savingsPlan: { name: fit.name, monthlyPrice: fit.monthlyPrice },
  };
}

function matchAllPatterns(
  input: RecommendationInput,
  config: ScoringConfig,
  monthlyAmount: number,
  yearlyAmount: number,
  p3: ResolvedP3,
): MatchedPattern[] {
  const patterns: MatchedPattern[] = [];

  // P1
  const p1 = matchP1(input, config);
  if (p1) patterns.push(p1);

  // P2〜P6
  patterns.push(...matchPatternsP2toP6(input, config, monthlyAmount, yearlyAmount, p3));

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
  p3: ResolvedP3,
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

  // P3（容量型は resolveP3 で容量ゲート済み）
  if (p3.show) {
    patterns.push({
      pattern: "P3",
      label: "安いプランがある",
      evidence: p3.evidence,
      ...(p3.caveat ? { caveat: p3.caveat } : {}),
      ...(p3.status ? { status: p3.status } : {}),
    });
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

  if (hasP2) return Decision.consider_cancel;

  const p3 = patterns.find((p) => p.pattern === "P3");
  // 容量型（iCloud+）で「安全に下げられる」と確認できている（P3 confirmed）ときは、
  // 他社への乗り換え（P4）より、同じエコシステム内での安全なダウングレードを優先する。
  // 本機能の狙い＝「怖くて下げられない固定費を安全に下げる」に沿う。容量型以外は不変。
  if (input.usageType === "capacity" && p3?.status === "confirmed") {
    return Decision.consider_downgrade;
  }

  if (hasP4) return Decision.consider_cancel;
  if (hasP3) {
    // 容量未確認/鮮度切れのダウングレード候補は断定せず様子見にとどめる。
    if (p3?.status === "needs_capacity_check") return Decision.review;
    return Decision.consider_downgrade;
  }

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
