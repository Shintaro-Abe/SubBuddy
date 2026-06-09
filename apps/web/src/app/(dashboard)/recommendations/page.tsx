import Link from "next/link";
import type { Decision } from "@prisma/client";
import { getCurrentUserId } from "@/lib/user";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { DECISION_LABEL, formatYen } from "@/lib/display";
import { DecisionBadge } from "@/components/DecisionBadge";
import { RecomputeButton } from "@/components/RecomputeButton";

export const dynamic = "force-dynamic";

const ORDER: Decision[] = [
  "strong_cancel_candidate",
  "consider_cancel",
  "consider_downgrade",
  "review",
  "keep",
];

export default async function RecommendationsPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(getCurrentUserId());
  const ready = rows.filter((r) => r.recommendation?.dataStatus === "ready");
  const observing = rows.filter((r) => r.recommendation?.dataStatus === "observing");
  const unjudged = rows.filter((r) => !r.recommendation);

  const groups = ORDER.map((decision) => ({
    decision,
    items: ready
      .filter((r) => r.recommendation?.decision === decision),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">レコメンド</h1>
        <RecomputeButton />
      </div>

      {rows.length > 0 && groups.length === 0 && observing.length === 0 && (
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
          まだ判定がありません。「判定を再計算」を実行してください。
        </p>
      )}

      {groups.map((g) => (
        <section key={g.decision} className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <DecisionBadge recommendation={{ decision: g.decision, dataStatus: "ready", daysUntilReady: 0 }} />
            <span>{DECISION_LABEL[g.decision]}（{g.items.length} 件）</span>
          </h2>
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {g.items.map(({ subscription: s, recommendation: rec }) => (
              <li key={s.id}>
                <Link
                  href={`/subscriptions/${s.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.name}</div>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <div className="font-medium">{formatYen(rec!.monthlyAmount)}/月</div>
                      {rec!.yearlyAmount > 0 && rec!.decision !== "keep" && (
                        <div className="text-xs text-red-600">
                          解約で年間{formatYen(rec!.yearlyAmount)}節約
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{rec!.reason}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {observing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700">観測中（{observing.length} 件）</h2>
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {observing.map(({ subscription: s, recommendation: rec }) => (
              <li key={s.id}>
                <Link
                  href={`/subscriptions/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
                >
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    あと {rec!.daysUntilReady} 日
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unjudged.length > 0 && (
        <p className="text-xs text-zinc-400">未判定 {unjudged.length} 件（再計算で判定されます）</p>
      )}
    </div>
  );
}
