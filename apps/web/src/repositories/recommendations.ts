import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecommendationResult } from "@/domain/scoring/computeRecommendation";

/**
 * recommendation_snapshots の永続化（design §3）。
 * スナップショットは履歴として追記し、画面では最新のみ表示する。
 */
type Db = Pick<PrismaClient, "recommendationSnapshot">;

/** 判定結果を1件分のスナップショットとして追記する。 */
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
      cancelScore: result.cancelScore,
      monthlyAmount: result.monthlyAmount,
      yearlyAmount: result.yearlyAmount,
      usageDays30d: result.usageDays30d,
      usageMinutes30d: result.usageMinutes30d,
      daysSinceLastUse: result.daysSinceLastUse,
      daysUntilRenewal: result.daysUntilRenewal,
      costPerUsageDay: result.costPerUsageDay,
      hasOverlap: result.hasOverlap,
      confidence: result.confidence,
      reason: result.reason,
    },
  });
}

/** サブスクごとの最新スナップショットを取得する。 */
export function listLatestRecommendations(userId: string, db: Db = prisma) {
  return db.recommendationSnapshot.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
    distinct: ["subscriptionId"],
  });
}
