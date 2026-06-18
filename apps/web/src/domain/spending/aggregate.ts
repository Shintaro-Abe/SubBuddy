import { toMonthlyAmount, toYearlyAmount, type BillingCycle } from "@/lib/money";

/**
 * 支出の集計（可視化用）。
 * 画面に依存しない純粋関数として実装し、現在時刻は referenceDate で受け取る
 * （Date.now() を内部で呼ばない＝同じ入力なら同じ結果でテスト可能）。
 *
 * 金額はすべて最小通貨単位の整数（円）で扱う。
 */

export interface SpendingSubscriptionInput {
  amount: number;
  billingCycle: BillingCycle;
  category: string;
  status: string; // "active" | "paused" | "canceled"
  createdAt: Date; // 登録日（月次推移の起点）
}

export interface CategorySpending {
  category: string;
  monthly: number; // 月額換算合計
  share: number; // 0..1（月額合計に対する構成比。合計0なら0）
}

export interface MonthlySpending {
  month: string; // "YYYY-MM"
  monthly: number; // その月末時点の月額換算合計
}

export interface SpendingSummary {
  monthlyTotal: number; // 現在 active の月額換算合計
  yearlyTotal: number; // 現在 active の年額換算合計（見込み）
  activeCount: number;
  byCategory: CategorySpending[]; // 月額降順
  monthlyTrend: MonthlySpending[]; // 古い→新しい順、長さ = windowMonths
}

export interface AggregateOptions {
  referenceDate: Date; // 「今月」を決める基準日
  windowMonths?: number; // 推移の対象月数（既定 6）
}

function ym(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

/**
 * 月次推移の定義（MVP）：
 * 各対象月の「月末時点で既に登録済み（createdAt が翌月1日より前）」かつ「現在 active」な
 * 契約の月額換算を合計する。解約日を保持していないため、現時点で active なものを母集団とし、
 * 登録の積み上がりを推移として表す。
 */
export function aggregateSpending(
  subs: SpendingSubscriptionInput[],
  options: AggregateOptions,
): SpendingSummary {
  const windowMonths = options.windowMonths ?? 6;
  const active = subs.filter((s) => s.status === "active");

  let monthlyTotal = 0;
  let yearlyTotal = 0;
  const categoryMap = new Map<string, number>();
  for (const s of active) {
    const m = toMonthlyAmount(s.amount, s.billingCycle);
    monthlyTotal += m;
    yearlyTotal += toYearlyAmount(s.amount, s.billingCycle);
    categoryMap.set(s.category, (categoryMap.get(s.category) ?? 0) + m);
  }

  const byCategory: CategorySpending[] = [...categoryMap.entries()]
    .map(([category, monthly]) => ({
      category,
      monthly,
      share: monthlyTotal > 0 ? monthly / monthlyTotal : 0,
    }))
    .sort((a, b) => b.monthly - a.monthly || a.category.localeCompare(b.category));

  const refY = options.referenceDate.getUTCFullYear();
  const refM = options.referenceDate.getUTCMonth();
  const monthlyTrend: MonthlySpending[] = [];
  for (let i = windowMonths - 1; i >= 0; i--) {
    // 対象月の「翌月1日 0:00 UTC」。createdAt がこれより前なら、その月末までに登録済み。
    const nextMonthStart = new Date(Date.UTC(refY, refM - i + 1, 1));
    const target = new Date(Date.UTC(refY, refM - i, 1));
    let total = 0;
    for (const s of active) {
      if (s.createdAt.getTime() < nextMonthStart.getTime()) {
        total += toMonthlyAmount(s.amount, s.billingCycle);
      }
    }
    monthlyTrend.push({ month: ym(target.getUTCFullYear(), target.getUTCMonth()), monthly: total });
  }

  return { monthlyTotal, yearlyTotal, activeCount: active.length, byCategory, monthlyTrend };
}
