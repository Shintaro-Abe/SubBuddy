import Link from "next/link";
import { getCurrentUserId } from "@/lib/user";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";
import { daysUntil, formatYen } from "@/lib/display";
import { RecomputeButton } from "@/components/RecomputeButton";

export const dynamic = "force-dynamic";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(getCurrentUserId());
  const active = rows.filter((r) => r.subscription.status === "active");

  let monthlyTotal = 0;
  let yearlyTotal = 0;
  for (const { subscription: s } of active) {
    monthlyTotal += toMonthlyAmount(s.amount, s.billingCycle);
    yearlyTotal += toYearlyAmount(s.amount, s.billingCycle);
  }

  const strongCancel = rows.filter(
    (r) => r.recommendation?.decision === "strong_cancel_candidate",
  ).length;
  const observing = rows.filter((r) => r.recommendation?.dataStatus === "observing").length;
  const renewalsSoon = active.filter((r) => {
    const days = daysUntil(r.subscription.nextRenewalDate);
    return days !== null && days >= 0 && days <= 14;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">ダッシュボード</h1>
        <RecomputeButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="月額合計（継続中）" value={formatYen(monthlyTotal)} sub={`${active.length} 件`} />
        <StatCard label="年額合計（継続中）" value={formatYen(yearlyTotal)} />
        <StatCard label="強い解約候補" value={`${strongCancel} 件`} sub="見直しをおすすめ" />
        <StatCard label="更新間近（14日以内）" value={`${renewalsSoon} 件`} sub={`観測中 ${observing} 件`} />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/subscriptions" className="text-zinc-700 underline hover:text-zinc-900">
          サブスク一覧へ
        </Link>
        <Link href="/recommendations" className="text-zinc-700 underline hover:text-zinc-900">
          レコメンドを見る
        </Link>
      </div>

      {rows.length === 0 && (
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
          サブスクがまだありません。
          <Link href="/subscriptions/new" className="ml-1 underline">
            登録する
          </Link>
        </p>
      )}
    </div>
  );
}
