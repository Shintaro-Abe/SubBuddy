import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecommendationResult } from "@/domain/scoring/computeRecommendation";

type Db = Pick<PrismaClient, "recommendationSnapshot">;

export function appendRecommendationSnapshot(
  userId: string,
  subscriptionId: string,
  result: RecommendationResult,
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
      usageDays30d: 0,
      usageMinutes30d: 0,
      daysSinceLastUse: result.daysSinceLastUse,
      daysUntilRenewal: result.daysUntilRenewal,
      costPerUsageDay: null,
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
