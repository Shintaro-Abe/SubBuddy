import { describe, expect, it } from "vitest";
import { aggregateSpending, type SpendingSubscriptionInput } from "./aggregate";

const ref = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15 を「今月」とする

function sub(p: Partial<SpendingSubscriptionInput>): SpendingSubscriptionInput {
  return {
    amount: 1000,
    billingCycle: "monthly",
    category: "other",
    status: "active",
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    ...p,
  };
}

describe("aggregateSpending", () => {
  it("0件なら合計0・配列は空・推移は windowMonths 分すべて0", () => {
    const r = aggregateSpending([], { referenceDate: ref, windowMonths: 6 });
    expect(r.monthlyTotal).toBe(0);
    expect(r.yearlyTotal).toBe(0);
    expect(r.activeCount).toBe(0);
    expect(r.byCategory).toEqual([]);
    expect(r.monthlyTrend).toHaveLength(6);
    expect(r.monthlyTrend.every((m) => m.monthly === 0)).toBe(true);
  });

  it("月額・年額換算（yearly は 12 で割って月額、年額はそのまま）", () => {
    const r = aggregateSpending(
      [
        sub({ amount: 1000, billingCycle: "monthly" }),
        sub({ amount: 12000, billingCycle: "yearly" }),
      ],
      { referenceDate: ref },
    );
    expect(r.monthlyTotal).toBe(1000 + 1000); // 12000/12 = 1000
    expect(r.yearlyTotal).toBe(12000 + 12000); // 1000*12 + 12000
    expect(r.activeCount).toBe(2);
  });

  it("カテゴリ別に集計し、構成比の合計はほぼ1（月額降順）", () => {
    const r = aggregateSpending(
      [
        sub({ amount: 3000, category: "video" }),
        sub({ amount: 1000, category: "music" }),
        sub({ amount: 1000, category: "music" }),
      ],
      { referenceDate: ref },
    );
    expect(r.byCategory[0]).toMatchObject({ category: "video", monthly: 3000 });
    expect(r.byCategory[1]).toMatchObject({ category: "music", monthly: 2000 });
    const shareSum = r.byCategory.reduce((a, c) => a + c.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);
  });

  it("active 以外（paused/canceled）は集計に含めない", () => {
    const r = aggregateSpending(
      [
        sub({ amount: 1000, status: "active" }),
        sub({ amount: 5000, status: "paused" }),
        sub({ amount: 9000, status: "canceled" }),
      ],
      { referenceDate: ref },
    );
    expect(r.monthlyTotal).toBe(1000);
    expect(r.activeCount).toBe(1);
  });

  it("月次推移は登録月から積み上がる（古い→新しい順）", () => {
    const r = aggregateSpending(
      [
        sub({ amount: 1000, createdAt: new Date(Date.UTC(2026, 3, 10)) }), // 2026-04 登録
        sub({ amount: 500, createdAt: new Date(Date.UTC(2026, 5, 1)) }), // 2026-06 登録
      ],
      { referenceDate: ref, windowMonths: 4 },
    );
    // 直近4ヶ月 = 2026-03, 04, 05, 06
    expect(r.monthlyTrend.map((m) => m.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(r.monthlyTrend.map((m) => m.monthly)).toEqual([0, 1000, 1000, 1500]);
  });

  it("年跨ぎの推移月ラベルが正しい", () => {
    const r = aggregateSpending([], {
      referenceDate: new Date(Date.UTC(2026, 0, 20)), // 2026-01
      windowMonths: 3,
    });
    expect(r.monthlyTrend.map((m) => m.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});
