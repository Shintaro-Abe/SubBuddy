import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Pick<PrismaClient, "$transaction">;

export interface DeletedMeasurementData {
  usageCount: number;
  recommendationCount: number;
}

/**
 * 契約を残したまま、その契約に属するScreen Time集計と見直し履歴を削除する。
 * 所有権確認と削除を同じトランザクションで行い、空の状態への再実行も成功させる。
 */
export function deleteMeasurementData(
  userId: string,
  subscriptionId: string,
  db: Db = prisma,
): Promise<DeletedMeasurementData | null> {
  return db.$transaction(async (tx) => {
    const subscription = await tx.subscription.findFirst({
      where: { id: subscriptionId, userId },
      select: { id: true },
    });
    if (!subscription) return null;

    const usage = await tx.iosUsageDailySummary.deleteMany({
      where: { userId, subscriptionId },
    });
    const recommendations = await tx.recommendationSnapshot.deleteMany({
      where: { userId, subscriptionId },
    });

    return {
      usageCount: usage.count,
      recommendationCount: recommendations.count,
    };
  });
}
