import { describe, expect, it } from "vitest";
import { aggregateUsage, type DailyUsagePoint } from "./aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;
const asOf = new Date("2026-06-04T00:00:00.000Z");
function daysBefore(n: number): Date {
  return new Date(asOf.getTime() - n * DAY_MS);
}

function usedOn(n: number, bucket: DailyUsagePoint["usageBucket"] = "30m_plus"): DailyUsagePoint {
  return { usageDate: daysBefore(n), used: true, usageBucket: bucket };
}

describe("aggregateUsage", () => {
  it("観測日数を登録からの経過日数で返す", () => {
    const r = aggregateUsage({ createdAt: daysBefore(10), asOf, windowDays: 30, points: [] });
    expect(r.observationDays).toBe(10);
    expect(r.usageDays30d).toBe(0);
    expect(r.daysSinceLastUse).toBeNull();
  });

  it("直近30日の利用日数と分数を集計（窓外は数えない）", () => {
    const points = [
      usedOn(1, "60m_plus"), // 窓内・60分
      usedOn(5, "15m_plus"), // 窓内・15分
      usedOn(29, "5m_plus"), // 窓内・5分
      usedOn(35, "120m_plus"), // 窓外（30日以上前）
      { usageDate: daysBefore(2), used: false, usageBucket: "none" as const }, // 未利用
    ];
    const r = aggregateUsage({ createdAt: daysBefore(200), asOf, windowDays: 30, points });
    expect(r.usageDays30d).toBe(3);
    expect(r.usageMinutes30d).toBe(60 + 15 + 5);
  });

  it("最終利用からの日数は全履歴の最小（最新利用日）", () => {
    const r = aggregateUsage({
      createdAt: daysBefore(200),
      asOf,
      windowDays: 30,
      points: [usedOn(65), usedOn(70)],
    });
    expect(r.daysSinceLastUse).toBe(65);
    expect(r.usageDays30d).toBe(0); // 直近30日は未使用
  });
});
