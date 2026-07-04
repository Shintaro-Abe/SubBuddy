import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NormalizedUsageDaily } from "@/domain/usage/normalize";

/**
 * ios_usage_daily_summaries の冪等 upsert（functional-design §5.2 / §10.1）。
 * subscription_id × usage_date を一意キーに upsert するため、同一バッチを再送しても行は増えない。
 */
type Db = Pick<PrismaClient, "iosUsageDailySummary" | "subscription">;

export class UsageSubscriptionNotFoundError extends Error {
  constructor() {
    super("subscription not found");
    this.name = "UsageSubscriptionNotFoundError";
  }
}

export interface UpsertUsageResult {
  upserted: number;
}

export async function upsertUsageDailyBatch(
  userId: string,
  items: NormalizedUsageDaily[],
  db: Db = prisma,
): Promise<UpsertUsageResult> {
  const subscriptionIds = [...new Set(items.map((item) => item.subscriptionId))];
  if (subscriptionIds.length > 0) {
    const ownedSubscriptions = await db.subscription.findMany({
      where: { userId, id: { in: subscriptionIds } },
      select: { id: true },
    });
    if (ownedSubscriptions.length !== subscriptionIds.length) {
      throw new UsageSubscriptionNotFoundError();
    }
  }

  for (const item of items) {
    await db.iosUsageDailySummary.upsert({
      where: {
        subscriptionId_usageDate: {
          subscriptionId: item.subscriptionId,
          usageDate: item.usageDate,
        },
      },
      create: {
        userId,
        subscriptionId: item.subscriptionId,
        usageDate: item.usageDate,
        used: item.used,
        usageBucket: item.usageBucket,
        estimatedMinutesMin: item.estimatedMinutesMin,
        estimatedMinutesMax: item.estimatedMinutesMax,
        source: item.source,
      },
      update: {
        used: item.used,
        usageBucket: item.usageBucket,
        estimatedMinutesMin: item.estimatedMinutesMin,
        estimatedMinutesMax: item.estimatedMinutesMax,
        source: item.source,
      },
    });
  }
  return { upserted: items.length };
}

/** 指定サブスクの利用サマリを新しい順で取得（集計用）。 */
export function listUsageForSubscription(
  userId: string,
  subscriptionId: string,
  db: Db = prisma,
) {
  return db.iosUsageDailySummary.findMany({
    where: { userId, subscriptionId },
    orderBy: { usageDate: "desc" },
  });
}
