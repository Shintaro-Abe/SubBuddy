import { Decision, DataStatus } from "@prisma/client";
import { toMonthlyAmount, toYearlyAmount, type BillingCycle } from "@/lib/money";
import { type ScoringConfig } from "@/config/scoring";
import { reasonForDecision, reasonObserving } from "./reasons";

/**
 * レコメンド判定の中核（純関数・副作用なし）。functional-design §8.3・§8.5 / design §5。
 *
 * 段階的な情報提供（案A）：
 *  - 利用に依存しない指摘（同カテゴリ重複・更新間近）は観測日数に関係なく即時に出す。
 *  - 利用に依存する判定（◯日未使用・単価）は、観測が minObservationDays に満たない間は
 *    確定させず data_status='observing'（「観測中 あと N 日」）とする。
 */

export interface RecommendationInput {
  /** 契約金額（最小通貨単位の整数）。 */
  amount: number;
  billingCycle: BillingCycle;
  /** 主観的重要度（1..5）。 */
  importance: number;
  /** 登録（createdAt）からの観測日数。 */
  observationDays: number;
  /** 直近30日の利用日数。 */
  usageDays30d: number;
  /** 直近30日の利用分数見積り。 */
  usageMinutes30d: number;
  /** 最終利用からの日数（一度も利用がなければ null）。 */
  daysSinceLastUse: number | null;
  /** 更新までの残り日数（不明なら null）。 */
  daysUntilRenewal: number | null;
  /** 同カテゴリに他の契約がある。 */
  hasCategoryOverlap: boolean;
  /** 同カテゴリ重複の中で利用が少ない側である。 */
  isLowerUsageInOverlap: boolean;
}

export interface RecommendationResult {
  /** 利用ベース判定。観測中（observing）の間は null。 */
  decision: Decision | null;
  dataStatus: DataStatus;
  observationDays: number;
  /** 確定まで残り日数（ready なら 0）。 */
  daysUntilReady: number;
  /** 0..100 の解約寄り度（並び替え・強調用）。 */
  cancelScore: number;
  monthlyAmount: number;
  yearlyAmount: number;
  usageDays30d: number;
  usageMinutes30d: number;
  daysSinceLastUse: number | null;
  daysUntilRenewal: number | null;
  /** 月額換算 ÷ 直近30日利用日数。未使用（0 日）なら null。 */
  costPerUsageDay: number | null;
  hasOverlap: boolean;
  /** 確からしさ（観測中は暫定 <1.0、確定で 1.0）。 */
  confidence: number;
  reason: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeRecommendation(
  input: RecommendationInput,
  config: ScoringConfig,
): RecommendationResult {
  const monthlyAmount = toMonthlyAmount(input.amount, input.billingCycle);
  const yearlyAmount = toYearlyAmount(input.amount, input.billingCycle);
  const costPerUsageDay =
    input.usageDays30d > 0 ? monthlyAmount / input.usageDays30d : null;

  const renewalSoon =
    input.daysUntilRenewal !== null && input.daysUntilRenewal <= config.renewalSoonDays;

  const base = {
    decision: null as Decision | null,
    observationDays: input.observationDays,
    monthlyAmount,
    yearlyAmount,
    usageDays30d: input.usageDays30d,
    usageMinutes30d: input.usageMinutes30d,
    daysSinceLastUse: input.daysSinceLastUse,
    daysUntilRenewal: input.daysUntilRenewal,
    costPerUsageDay,
    hasOverlap: input.hasCategoryOverlap,
  };

  // --- 観測中（利用ベース判定は保留。即時の指摘のみ） ---
  if (input.observationDays < config.minObservationDays) {
    const daysUntilReady = config.minObservationDays - input.observationDays;
    const confidence = clamp(
      Math.round((input.observationDays / config.minObservationDays) * 100) / 100,
      0.1,
      0.99,
    );
    // 即時の懸念（重複の低利用側／更新間近）があれば暫定的に少し高める。
    const cancelScore =
      input.hasCategoryOverlap && input.isLowerUsageInOverlap ? 40 : renewalSoon ? 20 : 5;
    return {
      ...base,
      dataStatus: DataStatus.observing,
      daysUntilReady,
      cancelScore,
      confidence,
      reason: reasonObserving(daysUntilReady, {
        hasCategoryOverlap: input.hasCategoryOverlap,
        renewalSoon,
        daysUntilRenewal: input.daysUntilRenewal,
      }),
    };
  }

  // --- 確定（利用ベース判定） ---
  // 未使用日数：最終利用がなければ「登録からの観測日数」を未使用とみなす。
  const unusedDays = input.daysSinceLastUse ?? input.observationDays;
  const isLowUsage = input.usageDays30d <= config.lowUsageMaxDays;
  const isHighImportance = input.importance >= config.highImportanceMin;

  let decision: Decision;
  if (unusedDays >= config.strongCancelUnusedDays) {
    decision = Decision.strong_cancel_candidate;
  } else if (
    unusedDays >= config.considerCancelUnusedDays &&
    monthlyAmount >= config.considerCancelMinAmount
  ) {
    decision = Decision.consider_cancel;
  } else if (input.hasCategoryOverlap && input.isLowerUsageInOverlap && isLowUsage) {
    decision = Decision.consider_cancel;
  } else if (isLowUsage && isHighImportance) {
    decision = Decision.review;
  } else {
    decision = Decision.keep;
  }

  // cancelScore：判定の帯 + 未使用日数による微調整（0..100）。
  const bandBase: Record<Decision, number> = {
    strong_cancel_candidate: 80,
    consider_cancel: 60,
    consider_downgrade: 45,
    review: 30,
    keep: 10,
  };
  const unusedBonus = (Math.min(unusedDays, 60) / 60) * 15;
  const cancelScore = Math.round(clamp(bandBase[decision] + unusedBonus, 0, 100));

  return {
    ...base,
    decision,
    dataStatus: DataStatus.ready,
    daysUntilReady: 0,
    cancelScore,
    confidence: 1.0,
    reason: reasonForDecision(decision, {
      unusedDays,
      usageDays30d: input.usageDays30d,
      monthlyAmount,
      importance: input.importance,
    }),
  };
}
