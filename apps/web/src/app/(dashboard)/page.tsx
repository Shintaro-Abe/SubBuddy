import Link from "next/link";
import { requireServerUserId } from "@/lib/server-auth";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";
import { daysUntil, formatYen } from "@/lib/display";
import { RecomputeButton } from "@/components/RecomputeButton";

export const dynamic = "force-dynamic";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel">
      <div className="caption">{label}</div>
      <div className="num mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="caption mt-1">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(await requireServerUserId());
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
    <div>
      <section className="pagehead flex items-start justify-between gap-4">
        <div>
          <p className="display">
            今月の支出は <span className="num">{formatYen(monthlyTotal)}</span> です。
          </p>
          <p className="caption mt-2">
            継続中 <span className="num">{active.length}</span> 件 ・ 年額見込み{" "}
            <span className="num">{formatYen(yearlyTotal)}</span>
          </p>
        </div>
        <RecomputeButton />
      </section>

      <section className="section">
        <div className="sechead">
          <h2 className="title">概況</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="月額合計（継続中）"
            value={formatYen(monthlyTotal)}
            sub={`${active.length} 件`}
          />
          <StatCard label="年額合計（継続中）" value={formatYen(yearlyTotal)} />
          <StatCard
            label="見直し候補"
            value={`${strongCancel} 件`}
            sub={observing > 0 ? `観測中 ${observing} 件` : undefined}
          />
          <StatCard label="更新間近（14日以内）" value={`${renewalsSoon} 件`} />
        </div>
      </section>

      <section className="section">
        <div className="sechead">
          <h2 className="title">次の一歩</h2>
        </div>
        <div className="flex flex-wrap gap-6">
          <Link href="/subscriptions" className="text-[var(--sage)] hover:underline">
            サブスク一覧へ →
          </Link>
          <Link href="/recommendations" className="text-[var(--sage)] hover:underline">
            判定の根拠を見る →
          </Link>
        </div>

        {strongCancel > 0 && (
          <div className="memo mt-5 flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="title">見直しメモ</p>
              <p className="body mt-2 max-w-[46ch]">
                見直し候補が <span className="num">{strongCancel}</span> 件あります。
                根拠をもとに、続けるか見直すかはご自身で判断できます。
              </p>
            </div>
            <Link href="/recommendations" className="memobtn">
              根拠の詳細を見る
            </Link>
          </div>
        )}

        {rows.length === 0 && (
          <div className="panel mt-5">
            <p className="body">
              サブスクがまだ登録されていません。
              <Link href="/subscriptions/new" className="ml-1 text-[var(--sage)] hover:underline">
                登録する
              </Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
