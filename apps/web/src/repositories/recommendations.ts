import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecommendationResult } from "@/domain/scoring/computeRecommendation";
import { validateReviewForDisplay } from "@/domain/review/validation";

type Db = Pick<PrismaClient, "recommendationSnapshot">;

export interface RecommendationUsageMetrics {
  usageDays30d: number;
  usageMinutes30d: number;
  costPerUsageDay: number | null;
}

export function buildRecommendationUsageMetrics(
  monthlyAmount: number,
  usageDays30d: number,
  usageMinutes30d: number,
): RecommendationUsageMetrics {
  return {
    usageDays30d,
    usageMinutes30d,
    costPerUsageDay: usageDays30d > 0 ? monthlyAmount / usageDays30d : null,
  };
}

export function appendRecommendationSnapshot(
  userId: string,
  subscriptionId: string,
  result: RecommendationResult,
  sourceSubscriptionUpdatedAt: Date,
  usage: RecommendationUsageMetrics,
  db: Db = prisma,
) {
  return db.recommendationSnapshot.create({
    data: {
      userId,
      subscriptionId,
      decision: result.decision,
      dataStatus: result.dataStatus,
      observationDays: result.observationDays,
      daysUntilReady: result.daysUntilReady,
      cancelScore: 0,
      monthlyAmount: result.monthlyAmount,
      yearlyAmount: result.yearlyAmount,
      usageDays30d: usage.usageDays30d,
      usageMinutes30d: usage.usageMinutes30d,
      daysSinceLastUse: result.daysSinceLastUse,
      daysUntilRenewal: result.daysUntilRenewal,
      costPerUsageDay: usage.costPerUsageDay,
      hasOverlap: result.hasOverlap,
      confidence: result.confidence,
      reason: result.reason,
      matchedPatterns: result.matchedPatterns, // 判定根拠を jsonb に保存（MatchedPattern[]）
      reviewPriority: result.reviewPriority,
      reviewUnknowns: result.reviewUnknowns,
      reviewOptions: result.reviewOptions,
      annualSavingsIfCancelled: result.annualSavingsIfCancelled,
      annualSavingsIfDowngraded: result.annualSavingsIfDowngraded,
      annualSavingsIfSwitched: result.annualSavingsIfSwitched,
      sourceSubscriptionUpdatedAt,
    },
  });
}

export function listLatestRecommendations(userId: string, db: Db = prisma) {
  return db.recommendationSnapshot.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
    distinct: ["subscriptionId"],
  });
}

export interface BlockedRecommendation {
  subscriptionId: string;
  message: string;
}

export async function listLatestRecommendationsForDisplay(
  userId: string,
  db: Db = prisma,
  asOf: Date = new Date(),
) {
  const rows = await db.recommendationSnapshot.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
    distinct: ["subscriptionId"],
    include: {
      subscription: {
        select: {
          id: true,
          userId: true,
          amount: true,
          billingCycle: true,
          updatedAt: true,
        },
      },
    },
  });

  const items = [];
  const blockedItems: BlockedRecommendation[] = [];
  for (const row of rows) {
    const validation = validateReviewForDisplay(userId, row, row.subscription, asOf);
    if (!validation.ok) {
      blockedItems.push({
        subscriptionId: row.subscriptionId,
        message: "見直し情報を安全に表示できません。再計算してください。",
      });
      continue;
    }
    const { subscription: relation, ...snapshot } = row;
    void relation;
    items.push(snapshot);
  }
  return { items, blockedItems };
}
