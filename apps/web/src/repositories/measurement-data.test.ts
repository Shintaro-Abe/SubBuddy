import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { deleteMeasurementData } from "./measurement-data";

function fakeDb(owned: boolean, usageCount = 2, recommendationCount = 1) {
  const calls: Array<{ model: string; where: unknown }> = [];
  const tx = {
    subscription: {
      findFirst: async () => (owned ? { id: "synthetic-subscription" } : null),
    },
    iosUsageDailySummary: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push({ model: "usage", where });
        return { count: usageCount };
      },
    },
    recommendationSnapshot: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push({ model: "recommendation", where });
        return { count: recommendationCount };
      },
    },
  };
  const db = {
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as Pick<PrismaClient, "$transaction">;
  return { db, calls };
}

describe("deleteMeasurementData", () => {
  it("所有する契約の利用量と見直しだけを対象条件付きで削除する", async () => {
    const { db, calls } = fakeDb(true);
    const result = await deleteMeasurementData(
      "synthetic-user",
      "synthetic-subscription",
      db,
    );

    expect(result).toEqual({ usageCount: 2, recommendationCount: 1 });
    expect(calls).toEqual([
      {
        model: "usage",
        where: {
          userId: "synthetic-user",
          subscriptionId: "synthetic-subscription",
        },
      },
      {
        model: "recommendation",
        where: {
          userId: "synthetic-user",
          subscriptionId: "synthetic-subscription",
        },
      },
    ]);
  });

  it("所有しない契約は削除しない", async () => {
    const { db, calls } = fakeDb(false);
    const result = await deleteMeasurementData(
      "synthetic-other-user",
      "synthetic-subscription",
      db,
    );

    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it("既に空の所有契約へ再実行しても成功する", async () => {
    const { db } = fakeDb(true, 0, 0);
    const result = await deleteMeasurementData(
      "synthetic-user",
      "synthetic-subscription",
      db,
    );

    expect(result).toEqual({ usageCount: 0, recommendationCount: 0 });
  });
});
