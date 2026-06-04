import Link from "next/link";
import type { SubscriptionWithRecommendation } from "@/lib/queries";
import { formatDate, formatYen } from "@/lib/display";
import { DecisionBadge } from "./DecisionBadge";

/**
 * 一覧で使うサブスクカード。クラス重複を避けるため共通化（T6-7）。
 */
export function SubscriptionCard({ row }: { row: SubscriptionWithRecommendation }) {
  const { subscription: s, recommendation: rec } = row;
  const cycleLabel = s.billingCycle === "yearly" ? "年額" : "月額";

  return (
    <Link
      href={`/subscriptions/${s.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{s.name}</div>
          <div className="mt-0.5 text-xs text-zinc-500">{s.category}</div>
        </div>
        <DecisionBadge recommendation={rec} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
        <span className="font-medium text-zinc-900">
          {formatYen(s.amount)}
          <span className="ml-1 text-xs text-zinc-500">/ {cycleLabel}</span>
        </span>
        <span>更新日: {formatDate(s.nextRenewalDate)}</span>
        {rec && rec.dataStatus === "ready" && (
          <span className="text-xs text-zinc-500">直近30日 {rec.usageDays30d} 日利用</span>
        )}
      </div>
    </Link>
  );
}
