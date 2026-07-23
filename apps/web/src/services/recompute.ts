import { aggregateUsage } from "@/domain/usage/aggregate";
import {
  computeRecommendation,
  type RecommendationResult,
  type UsageType,
  type CheaperOption,
  type InitialValueAnswer,
} from "@/domain/scoring/computeRecommendation";
import { defaultScoringConfig, type ScoringConfig } from "@/config/scoring";
import type { PlanCandidate } from "@/domain/capacity/fit";
import { toUsageBucketWire } from "@/lib/usage-bucket";
import { toMonthlyAmount } from "@/lib/money";
import { listSubscriptions } from "@/repositories/subscriptions";
import { listUsageForSubscription } from "@/repositories/usage";
import {
  appendRecommendationSnapshot,
  buildRecommendationUsageMetrics,
} from "@/repositories/recommendations";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecomputeResultItem extends RecommendationResult {
  subscriptionId: string;
  name: string;
}

function daysUntil(asOf: Date, target: Date | null): number | null {
  if (!target) return null;
  return Math.floor((target.getTime() - asOf.getTime()) / DAY_MS);
}

function diffMonths(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (DAY_MS * 30)));
}

function isFreshKnowledge(
  verifiedAt: Date | null,
  sourceUrl: string | null,
  asOf: Date,
  config: ScoringConfig,
): boolean {
  if (!verifiedAt || !sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return false;
  const ageDays = Math.floor((asOf.getTime() - verifiedAt.getTime()) / DAY_MS);
  return ageDays >= 0 && ageDays <= config.knowledgeBaseFreshnessDays;
}

export async function recomputeRecommendations(
  userId: string,
  config: ScoringConfig = defaultScoringConfig,
  asOf: Date = new Date(),
  onlySubscriptionId?: string,
): Promise<RecomputeResultItem[]> {
  const allSubscriptions = await listSubscriptions(userId);
  const subs = onlySubscriptionId
    ? allSubscriptions.filter((subscription) => subscription.id === onlySubscriptionId)
    : allSubscriptions;

  // 1) 利用集計
  const windowDays = 30;
  const aggregates = new Map<string, ReturnType<typeof aggregateUsage>>();
  const hasUsageData = new Map<string, boolean>();
  for (const s of subs) {
    const usage = await listUsageForSubscription(userId, s.id);
    hasUsageData.set(s.id, usage.length > 0);
    aggregates.set(
      s.id,
      aggregateUsage({
        createdAt: s.createdAt,
        asOf,
        windowDays,
        points: usage.map((u) => ({
          usageDate: u.usageDate,
          used: u.used,
          usageBucket: toUsageBucketWire(u.usageBucket),
        })),
      }),
    );
  }

  // 2) 同カテゴリ重複の判定
  const overlap = new Set<string>();
  const byCategory = new Map<string, typeof subs>();
  for (const s of subs) {
    if (s.status !== "active") continue;
    const arr = byCategory.get(s.category) ?? [];
    arr.push(s);
    byCategory.set(s.category, arr);
  }
  for (const arr of byCategory.values()) {
    if (arr.length < 2) continue;
    for (const s of arr) overlap.add(s.id);
  }

  // 3) 同カテゴリ最安月額（P2 用）
  const cheapestByCategory = new Map<string, number>();
  for (const [cat, arr] of byCategory.entries()) {
    if (arr.length < 2) continue;
    const prices = arr.map((s) => toMonthlyAmount(s.amount, s.billingCycle));
    cheapestByCategory.set(cat, Math.min(...prices));
  }

  // 4) スコアリング → スナップショット追記
  const results: RecomputeResultItem[] = [];
  for (const s of subs) {
    const agg = aggregates.get(s.id)!;
    const usageType = (s.usageType ?? "active_foreground") as UsageType;
    const judgmentSpanDays = s.billingCycle === "yearly" ? 365 : 30;
    const contractMonths = diffMonths(s.createdAt, asOf);
    const monthlyAmt = toMonthlyAmount(s.amount, s.billingCycle);
    const cumulativeSpend = monthlyAmt * contractMonths;

    // P3/P4 用：知識ベースから取得
    let cheaperPlan: CheaperOption | null = null;
    let cheaperAlternative: CheaperOption | null = null;
    let cheaperPlanCandidates: PlanCandidate[] = [];
    let hasStaleCatalogCandidates = false;
    let currentPlanCapacityGb: number | null = s.planCapacityGb ?? null;

    const matchedServiceId = s.matchedServiceId;
    if (matchedServiceId) {
      const allPlans = await prisma.servicePlan.findMany({
        where: {
          serviceId: matchedServiceId,
          isFreeTier: false,
        },
        orderBy: { monthlyPrice: "asc" },
      });
      const cheaperPlans = allPlans.filter((plan) => plan.monthlyPrice < monthlyAmt);
      const plans = cheaperPlans.filter((plan) =>
        isFreshKnowledge(plan.verifiedAt, plan.sourceUrl, asOf, config),
      );
      hasStaleCatalogCandidates = cheaperPlans.length > plans.length;
      if (plans.length > 0) {
        cheaperPlan = {
          name: plans[0].name,
          monthlyPrice: plans[0].monthlyPrice,
          verifiedAt: plans[0].verifiedAt.toISOString(),
          sourceUrl: plans[0].sourceUrl as string,
        };
      }
      // 容量ゲート用：容量(GB)を持つ安い有料プラン候補（iCloud+ など容量型で使用）
      cheaperPlanCandidates = plans
        .filter((p) => p.capacityGb !== null)
        .map((p) => ({
          name: p.name,
          monthlyPrice: p.monthlyPrice,
          capacityGb: p.capacityGb as number,
        }));

      if (currentPlanCapacityGb === null) {
        const currentCandidates = allPlans.filter((plan) =>
          plan.capacityGb !== null &&
          isFreshKnowledge(plan.verifiedAt, plan.sourceUrl, asOf, config),
        );
        const currentPlan = currentCandidates.reduce<(typeof currentCandidates)[number] | null>(
          (best, plan) => !best ||
            Math.abs(plan.monthlyPrice - monthlyAmt) < Math.abs(best.monthlyPrice - monthlyAmt)
            ? plan
            : best,
          null,
        );
        currentPlanCapacityGb = currentPlan?.capacityGb ?? null;
      }

      const alts = await prisma.serviceAlternative.findMany({
        where: { fromServiceId: matchedServiceId },
      });
      for (const alt of alts) {
        if (!isFreshKnowledge(alt.verifiedAt, alt.sourceUrl, asOf, config)) {
          hasStaleCatalogCandidates = true;
          continue;
        }
        const altPlans = await prisma.servicePlan.findMany({
          where: {
            serviceId: alt.toServiceId,
            isFreeTier: false,
          },
          orderBy: { monthlyPrice: "asc" },
        });
        if (altPlans.length > 0) {
          const freshAltPlans = altPlans.filter((plan) =>
            isFreshKnowledge(plan.verifiedAt, plan.sourceUrl, asOf, config),
          );
          if (freshAltPlans.length < altPlans.length) hasStaleCatalogCandidates = true;
          if (freshAltPlans.length === 0) continue;
          const altPrice = freshAltPlans[0].monthlyPrice;
          if (altPrice < monthlyAmt) {
            const altService = await prisma.serviceCatalog.findUnique({
              where: { id: alt.toServiceId },
            });
            if (altService && (!cheaperAlternative || altPrice < cheaperAlternative.monthlyPrice)) {
              cheaperAlternative = {
                name: altService.canonicalName,
                monthlyPrice: altPrice,
                verifiedAt: freshAltPlans[0].verifiedAt.toISOString(),
                sourceUrl: freshAltPlans[0].sourceUrl as string,
              };
            }
          }
        }
      }
    }

    // 同カテゴリ最安
    const cheapestInCat = overlap.has(s.id)
      ? cheapestByCategory.get(s.category) ?? null
      : null;

    // スパン内の利用日数
    const usageDaysInSpan = agg.usageDays30d;

    const result = computeRecommendation(
      {
        amount: s.amount,
        billingCycle: s.billingCycle,
        importance: s.importance,
        observationDays: agg.observationDays,
        daysSinceLastUse: agg.daysSinceLastUse,
        hasUsageData: hasUsageData.get(s.id)!,
        daysUntilRenewal: daysUntil(asOf, s.nextRenewalDate),
        hasCategoryOverlap: overlap.has(s.id),
        usageType,
        usageDaysInSpan,
        judgmentSpanDays,
        contractMonths,
        cumulativeSpend,
        cheaperPlan,
        cheaperAlternative,
        cheapestInCategory: cheapestInCat,
        initialValueAnswer: (s.initialValueAnswer as InitialValueAnswer | null) ?? null,
        usedCapacityGb: s.usedCapacityGb ?? null,
        daysSinceCapacityCheck: s.capacityCheckedAt
          ? Math.floor((asOf.getTime() - s.capacityCheckedAt.getTime()) / DAY_MS)
          : null,
        cheaperPlanCandidates,
        planCapacityGb: currentPlanCapacityGb,
        hasStaleCatalogCandidates,
      },
      config,
    );
    await appendRecommendationSnapshot(
      userId,
      s.id,
      result,
      s.updatedAt,
      buildRecommendationUsageMetrics(
        monthlyAmt,
        agg.usageDays30d,
        agg.usageMinutes30d,
      ),
    );
    results.push({ subscriptionId: s.id, name: s.name, ...result });
  }
  return results;
}

/**
 * 契約・利用量の変更後に対象契約だけを更新する。
 * 失敗しても元データの保存は成功扱いとし、古い見直しだけを表示させない。
 */
export async function refreshRecommendationAfterMutation(
  userId: string,
  subscriptionId: string,
  config: ScoringConfig = defaultScoringConfig,
  asOf: Date = new Date(),
): Promise<boolean> {
  try {
    await prisma.recommendationSnapshot.deleteMany({ where: { userId, subscriptionId } });
    await recomputeRecommendations(userId, config, asOf, subscriptionId);
    return true;
  } catch {
    return false;
  }
}
