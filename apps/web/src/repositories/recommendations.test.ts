import { DataStatus, Decision } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { RecommendationResult } from "@/domain/scoring/computeRecommendation";
import {
  appendRecommendationSnapshot,
  buildRecommendationUsageMetrics,
} from "./recommendations";

const result: RecommendationResult = {
  decision: Decision.keep,
  dataStatus: DataStatus.ready,
  observationDays: 14,
  daysUntilReady: 0,
  matchedPatterns: [],
  annualSavingsIfCancelled: 12_000,
  annualSavingsIfDowngraded: null,
  monthlyAmount: 1_000,
  yearlyAmount: 12_000,
  daysSinceLastUse: 0,
  daysUntilRenewal: 20,
  hasOverlap: false,
  confidence: 0.5,
  reason: "合成データでは継続候補です",
};

describe("recommendation snapshot usage metrics", () => {
  it("利用集計から30日値と1利用日単価を作る", () => {
    expect(buildRecommendationUsageMetrics(1_200, 3, 45)).toEqual({
      usageDays30d: 3,
      usageMinutes30d: 45,
      costPerUsageDay: 400,
    });
    expect(buildRecommendationUsageMetrics(1_200, 0, 0)).toEqual({
      usageDays30d: 0,
      usageMinutes30d: 0,
      costPerUsageDay: null,
    });
  });

  it("集計済みの利用日・利用分・1利用日単価を固定値にせず保存する", async () => {
    const create = vi.fn().mockResolvedValue({ id: "synthetic-recommendation" });
    const db = { recommendationSnapshot: { create } };

    await appendRecommendationSnapshot(
      "synthetic-user",
      "synthetic-subscription",
      result,
      {
        usageDays30d: 1,
        usageMinutes30d: 15,
        costPerUsageDay: 1_000,
      },
      db as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usageDays30d: 1,
        usageMinutes30d: 15,
        costPerUsageDay: 1_000,
      }),
    });
  });

  it("利用日が0日の場合は単価を保存しない", async () => {
    const create = vi.fn().mockResolvedValue({ id: "synthetic-recommendation" });
    const db = { recommendationSnapshot: { create } };

    await appendRecommendationSnapshot(
      "synthetic-user",
      "synthetic-subscription",
      result,
      {
        usageDays30d: 0,
        usageMinutes30d: 0,
        costPerUsageDay: null,
      },
      db as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usageDays30d: 0,
        usageMinutes30d: 0,
        costPerUsageDay: null,
      }),
    });
  });
});
