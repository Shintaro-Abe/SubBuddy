import { getCurrentUserId } from "@/lib/user";
import { listSubscriptions } from "@/repositories/subscriptions";
import { aggregateSpending } from "@/domain/spending/aggregate";
import { formatYen } from "@/lib/display";

export const dynamic = "force-dynamic";

/**
 * 支出可視化（仮 UI・動作確認用）。
 * 仕上げのデザインは別途。ここでは集計結果が正しく出ることの確認を優先する。
 */
export default async function SpendingPage() {
  const subs = await listSubscriptions(getCurrentUserId());
  const summary = aggregateSpending(
    subs.map((s) => ({
      amount: s.amount,
      billingCycle: s.billingCycle,
      category: s.category,
      status: s.status,
      createdAt: s.createdAt,
    })),
    { referenceDate: new Date(), windowMonths: 6 },
  );

  const maxTrend = Math.max(1, ...summary.monthlyTrend.map((m) => m.monthly));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">支出の可視化</h1>
        <p className="mt-1 text-sm text-zinc-500">
          継続中の契約から、月額・年額・カテゴリ内訳・月ごとの推移を集計しています（仮表示）。
        </p>
      </div>

      {/* 合計 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">月額合計（継続中）</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{formatYen(summary.monthlyTotal)}</div>
          <div className="mt-1 text-xs text-zinc-500">{summary.activeCount} 件</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">年額見込み（継続中）</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{formatYen(summary.yearlyTotal)}</div>
        </div>
      </div>

      {/* カテゴリ別内訳 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">カテゴリ別の内訳（月額）</h2>
        {summary.byCategory.length === 0 ? (
          <p className="text-sm text-zinc-500">継続中の契約がありません。</p>
        ) : (
          <ul className="space-y-2">
            {summary.byCategory.map((c) => (
              <li key={c.category} className="text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-700">{c.category}</span>
                  <span className="tabular-nums text-zinc-900">
                    {formatYen(c.monthly)}
                    <span className="ml-2 text-zinc-400">{Math.round(c.share * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-zinc-800"
                    style={{ width: `${Math.round(c.share * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 月次推移 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-700">月ごとの推移（月額換算）</h2>
        <p className="mb-3 text-xs text-zinc-400">
          各月末までに登録済みの継続中契約の月額合計。登録が増えるほど積み上がります。
        </p>
        <div className="flex items-end gap-3" style={{ height: 160 }}>
          {summary.monthlyTrend.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-xs tabular-nums text-zinc-600">{formatYen(m.monthly)}</span>
              <div
                className="w-full rounded-t bg-emerald-600/80"
                style={{ height: `${Math.round((m.monthly / maxTrend) * 130)}px` }}
              />
              <span className="mt-1 text-xs text-zinc-400">{m.month.slice(5)}月</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
