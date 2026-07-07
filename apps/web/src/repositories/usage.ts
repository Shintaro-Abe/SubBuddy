import type { PrismaClient } from "@prisma/client";
import { UsageBucket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NormalizedUsageDaily } from "@/domain/usage/normalize";
import { usageBucketRank } from "@/lib/usage-bucket";

/**
 * ios_usage_daily_summaries の冪等 upsert（functional-design §5.2 / §10.1）。
 * subscription_id × usage_date を一意キーに upsert するため、同一バッチを再送しても行は増えない。
 */
type UsageDailyExisting = {
  used: boolean;
  usageBucket: UsageBucket;
  estimatedMinutesMin: number | null;
  estimatedMinutesMax: number | null;
  source: string;
};

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

function maxNullableNumber(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/**
 * ADR 0006 の max マージ。
 * 同一日レコードの再送・追加送信では、後勝ち上書きではなく「観測された最大利用量」へ収束させる。
 */
export function mergeUsageDaily(
  existing: UsageDailyExisting | null,
  incoming: NormalizedUsageDaily,
): Pick<
  NormalizedUsageDaily,
  "used" | "usageBucket" | "estimatedMinutesMin" | "estimatedMinutesMax" | "source"
> {
  if (!existing) {
    return {
      used: incoming.used,
      usageBucket: incoming.usageBucket,
      estimatedMinutesMin: incoming.estimatedMinutesMin,
      estimatedMinutesMax: incoming.estimatedMinutesMax,
      source: incoming.source,
    };
  }

  const existingRank = usageBucketRank(existing.usageBucket);
  const incomingRank = usageBucketRank(incoming.usageBucket);
  return {
    used: existing.used || incoming.used,
    usageBucket: incomingRank > existingRank ? incoming.usageBucket : existing.usageBucket,
    estimatedMinutesMin: maxNullableNumber(existing.estimatedMinutesMin, incoming.estimatedMinutesMin),
    estimatedMinutesMax: maxNullableNumber(existing.estimatedMinutesMax, incoming.estimatedMinutesMax),
    source: incomingRank > existingRank ? incoming.source : existing.source,
  };
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
    const where = {
      subscriptionId_usageDate: {
        subscriptionId: item.subscriptionId,
        usageDate: item.usageDate,
      },
    };
    const existing = await db.iosUsageDailySummary.findUnique({
      where,
      select: {
        used: true,
        usageBucket: true,
        estimatedMinutesMin: true,
        estimatedMinutesMax: true,
        source: true,
      },
    });
    const merged = mergeUsageDaily(existing, item);

    await db.iosUsageDailySummary.upsert({
      where,
      create: {
        userId,
        subscriptionId: item.subscriptionId,
        usageDate: item.usageDate,
        ...merged,
      },
      update: merged,
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
