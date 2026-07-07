import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { UsageBucket } from "@prisma/client";
import { UsageSubscriptionNotFoundError, mergeUsageDaily, upsertUsageDailyBatch } from "./usage";
import type { NormalizedUsageDaily } from "@/domain/usage/normalize";

/**
 * 冪等 upsert の契約テスト（T4-4）。
 * 実 DB ではなくフェイククライアントで「create ではなく compound key の upsert を使うこと」を確認する。
 * → 同一バッチを再送しても、同じキーへの upsert になり行が増えないことを保証する。
 * （DB 実体での行数確認は Phase 5 の通し確認で実施。）
 */
function fakeDb(ownedSubscriptionIds = ["sub_1", "sub_2"]) {
  const calls: { where: unknown; update: unknown }[] = [];
  const db = {
    subscription: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        ownedSubscriptionIds
          .filter((id) => args.where.id.in.includes(id))
          .map((id) => ({ id })),
    },
    iosUsageDailySummary: {
      findUnique: async () => null,
      upsert: async (args: { where: unknown; update: unknown }) => {
        calls.push({ where: args.where, update: args.update });
        return {};
      },
    },
  } as unknown as Pick<PrismaClient, "iosUsageDailySummary" | "subscription">;
  return { db, calls };
}

function fakeDbWithExisting(existingByKey: Record<string, unknown>, ownedSubscriptionIds = ["sub_1", "sub_2"]) {
  const calls: { where: unknown; update: unknown }[] = [];
  const db = {
    subscription: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        ownedSubscriptionIds
          .filter((id) => args.where.id.in.includes(id))
          .map((id) => ({ id })),
    },
    iosUsageDailySummary: {
      findUnique: async (args: { where: { subscriptionId_usageDate: { subscriptionId: string } } }) =>
        existingByKey[args.where.subscriptionId_usageDate.subscriptionId] ?? null,
      upsert: async (args: { where: unknown; update: unknown }) => {
        calls.push({ where: args.where, update: args.update });
        return {};
      },
    },
  } as unknown as Pick<PrismaClient, "iosUsageDailySummary" | "subscription">;
  return { db, calls };
}

const items: NormalizedUsageDaily[] = [
  {
    subscriptionId: "sub_1",
    usageDate: new Date("2026-05-30T00:00:00.000Z"),
    used: true,
    usageBucket: UsageBucket.m30_plus,
    estimatedMinutesMin: null,
    estimatedMinutesMax: null,
    source: "ios_device_activity",
  },
  {
    subscriptionId: "sub_2",
    usageDate: new Date("2026-05-31T00:00:00.000Z"),
    used: false,
    usageBucket: UsageBucket.none,
    estimatedMinutesMin: null,
    estimatedMinutesMax: null,
    source: "manual_synthetic",
  },
];

describe("upsertUsageDailyBatch", () => {
  it("各件を subscriptionId × usageDate の複合キーで upsert する", async () => {
    const { db, calls } = fakeDb();
    const r = await upsertUsageDailyBatch("user_local", items, db);
    expect(r.upserted).toBe(2);
    expect(calls[0].where).toEqual({
      subscriptionId_usageDate: {
        subscriptionId: "sub_1",
        usageDate: new Date("2026-05-30T00:00:00.000Z"),
      },
    });
  });

  it("同一バッチを再送しても同じキーへの upsert になる（冪等）", async () => {
    const { db, calls } = fakeDb();
    await upsertUsageDailyBatch("user_local", items, db);
    await upsertUsageDailyBatch("user_local", items, db);
    expect(calls).toHaveLength(4);
    // 1回目と2回目で同じキーを指している（create ではなく upsert なので行は増えない）。
    expect(calls[0].where).toEqual(calls[2].where);
    expect(calls[1].where).toEqual(calls[3].where);
  });

  it("認証済み userId の所有サブスクでない場合は保存しない", async () => {
    const { db, calls } = fakeDb(["sub_1"]);
    await expect(upsertUsageDailyBatch("user_local", items, db)).rejects.toBeInstanceOf(
      UsageSubscriptionNotFoundError,
    );
    expect(calls).toHaveLength(0);
  });

  it("既存行がある場合は後勝ちではなくバケット最大値へマージする", async () => {
    const incoming: NormalizedUsageDaily[] = [
      {
        subscriptionId: "sub_1",
        usageDate: new Date("2026-05-30T00:00:00.000Z"),
        used: false,
        usageBucket: UsageBucket.m15_plus,
        estimatedMinutesMin: 15,
        estimatedMinutesMax: 29,
        source: "ios_device_activity",
      },
    ];
    const { db, calls } = fakeDbWithExisting({
      sub_1: {
        used: true,
        usageBucket: UsageBucket.m60_plus,
        estimatedMinutesMin: 60,
        estimatedMinutesMax: 119,
        source: "ios_device_activity",
      },
    });

    await upsertUsageDailyBatch("user_local", incoming, db);

    expect(calls[0].update).toEqual({
      used: true,
      usageBucket: UsageBucket.m60_plus,
      estimatedMinutesMin: 60,
      estimatedMinutesMax: 119,
      source: "ios_device_activity",
    });
  });
});

describe("mergeUsageDaily", () => {
  it("新しいバケットが大きい場合は新しい値を採用し、used と分推定は最大へ寄せる", () => {
    const incoming = {
      subscriptionId: "sub_1",
      usageDate: new Date("2026-05-30T00:00:00.000Z"),
      used: true,
      usageBucket: UsageBucket.m120_plus,
      estimatedMinutesMin: 120,
      estimatedMinutesMax: null,
      source: "ios_device_activity",
    };

    expect(
      mergeUsageDaily(
        {
          used: false,
          usageBucket: UsageBucket.m30_plus,
          estimatedMinutesMin: 30,
          estimatedMinutesMax: 59,
          source: "manual_synthetic",
        },
        incoming,
      ),
    ).toEqual({
      used: true,
      usageBucket: UsageBucket.m120_plus,
      estimatedMinutesMin: 120,
      estimatedMinutesMax: 59,
      source: "ios_device_activity",
    });
  });

  it("新しいバケットが小さい場合も既存値を下げない", () => {
    const incoming = {
      subscriptionId: "sub_1",
      usageDate: new Date("2026-05-30T00:00:00.000Z"),
      used: false,
      usageBucket: UsageBucket.m5_plus,
      estimatedMinutesMin: 5,
      estimatedMinutesMax: 14,
      source: "ios_device_activity",
    };

    expect(
      mergeUsageDaily(
        {
          used: true,
          usageBucket: UsageBucket.m60_plus,
          estimatedMinutesMin: 60,
          estimatedMinutesMax: 119,
          source: "ios_device_activity",
        },
        incoming,
      ),
    ).toEqual({
      used: true,
      usageBucket: UsageBucket.m60_plus,
      estimatedMinutesMin: 60,
      estimatedMinutesMax: 119,
      source: "ios_device_activity",
    });
  });
});
