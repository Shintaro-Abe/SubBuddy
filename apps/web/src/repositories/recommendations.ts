import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecommendationResult } from "@/domain/scoring/computeRecommendation";

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
