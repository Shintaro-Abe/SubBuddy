import type { PrismaClient } from "@prisma/client";
import { UsageBucket } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { aggregateUsage } from "@/domain/usage/aggregate";
import { normalizeUsageBatch } from "@/domain/usage/normalize";
import { toUsageBucketWire } from "@/lib/usage-bucket";
import { usageDailyBatchSchema, type UsageDailyItemInput } from "@/schemas/usage";
import { upsertUsageDailyBatch } from "./usage";

type StoredUsage = {
  userId: string;
  subscriptionId: string;
  usageDate: Date;
  used: boolean;
  usageBucket: UsageBucket;
  estimatedMinutesMin: number | null;
  estimatedMinutesMax: number | null;
  source: string;
};

function usageKey(subscriptionId: string, usageDate: Date): string {
  return `${subscriptionId}:${usageDate.toISOString()}`;
}

function statefulFakeDb(subscriptionId: string) {
  const stored = new Map<string, StoredUsage>();
  const db = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    subscription: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in.includes(subscriptionId) ? [{ id: subscriptionId }] : [],
    },
    iosUsageDailySummary: {
      findMany: async (args: {
        where: { OR?: Array<{ subscriptionId: string; usageDate: Date }> };
      }) => {
        const requested = args.where.OR ?? [];
        return requested.flatMap((item) => {
          const row = stored.get(usageKey(item.subscriptionId, item.usageDate));
          return row ? [row] : [];
        });
      },
      upsert: async (args: {
        where: { subscriptionId_usageDate: { subscriptionId: string; usageDate: Date } };
        create: StoredUsage;
        update: Omit<StoredUsage, "userId" | "subscriptionId" | "usageDate">;
      }) => {
        const key = usageKey(
          args.where.subscriptionId_usageDate.subscriptionId,
          args.where.subscriptionId_usageDate.usageDate,
        );
        const existing = stored.get(key);
        stored.set(key, existing ? { ...existing, ...args.update } : args.create);
        return stored.get(key);
      },
    },
  } as unknown as Pick<PrismaClient, "$transaction" | "iosUsageDailySummary" | "subscription">;

  return { db, stored };
}

const subscriptionId = "synthetic-subscription-seven-days";
const dates = [
  "2026-07-13",
  "2026-07-14",
  "2026-07-15",
  "2026-07-16",
  "2026-07-17",
  "2026-07-18",
  "2026-07-19",
];

function syntheticUsage(date: string): UsageDailyItemInput {
  return {
    subscriptionId,
    date,
    used: true,
    usageBucket: "15m_plus",
    estimatedMinutesMin: 15,
    estimatedMinutesMax: 29,
    source: "manual_synthetic",
  };
}

describe("Screen Time 7日分の合成データ", () => {
  it("順不同送信と同日再送後も7利用日へ収束する", async () => {
    const { db, stored } = statefulFakeDb(subscriptionId);
    const firstBatch = usageDailyBatchSchema.parse({ items: dates.slice(0, 3).map(syntheticUsage) });
    const delayedBatch = usageDailyBatchSchema.parse({
      items: dates.slice(3).reverse().map(syntheticUsage),
    });
    const lowerSameDayRetry = usageDailyBatchSchema.parse({
      items: [
        {
          ...syntheticUsage("2026-07-17"),
          usageBucket: "5m_plus",
          estimatedMinutesMin: 5,
          estimatedMinutesMax: 14,
        },
      ],
    });

    await upsertUsageDailyBatch("synthetic-user", normalizeUsageBatch(firstBatch.items), db);
    await upsertUsageDailyBatch("synthetic-user", normalizeUsageBatch(delayedBatch.items), db);
    await upsertUsageDailyBatch("synthetic-user", normalizeUsageBatch(lowerSameDayRetry.items), db);

    const rows = [...stored.values()];
    const aggregate = aggregateUsage({
      createdAt: new Date("2026-07-12T00:00:00.000Z"),
      asOf: new Date("2026-07-19T12:00:00.000Z"),
      windowDays: 30,
      points: rows.map((row) => ({
        usageDate: row.usageDate,
        used: row.used,
        usageBucket: toUsageBucketWire(row.usageBucket),
      })),
    });

    expect(rows).toHaveLength(7);
    expect(new Set(rows.map((row) => row.usageDate.toISOString()))).toHaveLength(7);
    expect(stored.get(usageKey(subscriptionId, new Date("2026-07-17T00:00:00.000Z")))).toMatchObject({
      usageBucket: UsageBucket.m15_plus,
      estimatedMinutesMin: 15,
      estimatedMinutesMax: 29,
    });
    expect(aggregate).toMatchObject({
      usageDays30d: 7,
      usageMinutes30d: 105,
      daysSinceLastUse: 0,
    });
  });
});
