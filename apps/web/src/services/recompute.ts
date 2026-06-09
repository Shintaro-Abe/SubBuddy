import { aggregateUsage } from "@/domain/usage/aggregate";
import {
  computeRecommendation,
  type RecommendationResult,
  type UsageType,
  type CheaperOption,
  type InitialValueAnswer,
} from "@/domain/scoring/computeRecommendation";
import { defaultScoringConfig, type ScoringConfig } from "@/config/scoring";
import { toUsageBucketWire } from "@/lib/usage-bucket";
import { toMonthlyAmount } from "@/lib/money";
import { listSubscriptions } from "@/repositories/subscriptions";
import { listUsageForSubscription } from "@/repositories/usage";
import { appendRecommendationSnapshot } from "@/repositories/recommendations";
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

export async function recomputeRecommendations(
  userId: string,
  config: ScoringConfig = defaultScoringConfig,
  asOf: Date = new Date(),
): Promise<RecomputeResultItem[]> {
  const subs = await listSubscriptions(userId);

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

    const matchedServiceId = (s as Record<string, unknown>).matchedServiceId as string | null;
    if (matchedServiceId) {
      const plans = await prisma.servicePlan.findMany({
        where: {
          serviceId: matchedServiceId,
          isFreeTier: false,
          monthlyPrice: { lt: monthlyAmt },
        },
        orderBy: { monthlyPrice: "asc" },
      });
      if (plans.length > 0) {
        const staleDays = Math.floor((asOf.getTime() - plans[0].verifiedAt.getTime()) / DAY_MS);
        const confidence = staleDays > config.knowledgeBaseStaleDays
          ? config.staleConfidenceMultiplier : 1.0;
        cheaperPlan = {
          name: plans[0].name,
          monthlyPrice: Math.round(plans[0].monthlyPrice * confidence),
        };
      }

      const alts = await prisma.serviceAlternative.findMany({
        where: { fromServiceId: matchedServiceId },
      });
      for (const alt of alts) {
        const altPlans = await prisma.servicePlan.findMany({
          where: {
            serviceId: alt.toServiceId,
            isFreeTier: false,
          },
          orderBy: { monthlyPrice: "asc" },
        });
        if (altPlans.length > 0 && altPlans[0].monthlyPrice < monthlyAmt) {
          const altService = await prisma.serviceCatalog.findUnique({
            where: { id: alt.toServiceId },
          });
          if (altService && (!cheaperAlternative || altPlans[0].monthlyPrice < cheaperAlternative.monthlyPrice)) {
            cheaperAlternative = {
              name: altService.canonicalName,
              monthlyPrice: altPlans[0].monthlyPrice,
            };
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
      },
      config,
    );
    await appendRecommendationSnapshot(userId, s.id, result);
    results.push({ subscriptionId: s.id, name: s.name, ...result });
  }
  return results;
}
