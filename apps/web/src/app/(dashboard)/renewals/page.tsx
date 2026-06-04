import Link from "next/link";
import { getCurrentUserId } from "@/lib/user";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { daysUntil, formatDate, formatYen } from "@/lib/display";
import { DecisionBadge } from "@/components/DecisionBadge";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 14;

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const parsed = Number(daysParam);
  const days = Number.isInteger(parsed) && parsed >= 1 && parsed <= 365 ? parsed : DEFAULT_DAYS;

  const rows = await getSubscriptionsWithLatestRecommendation(getCurrentUserId());
  const upcoming = rows
    .filter((r) => r.subscription.status === "active" && r.subscription.nextRenewalDate)
    .map((r) => ({ ...r, daysUntil: daysUntil(r.subscription.nextRenewalDate) ?? -1 }))
    .filter((r) => r.daysUntil >= 0 && r.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">更新間近（{days} 日以内）</h1>

      {upcoming.length === 0 ? (
        <p className="rounded-md bg-zinc-100 p-4 text-sm text-zinc-600">
          {days} 日以内に更新予定のサブスクはありません。
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {upcoming.map(({ subscription: s, recommendation: rec, daysUntil }) => (
            <li key={s.id}>
              <Link
                href={`/subscriptions/${s.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    <DecisionBadge recommendation={rec} />
                  </div>
                  <div className="text-xs text-zinc-500">
                    更新日 {formatDate(s.nextRenewalDate)}・{formatYen(s.amount)}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-medium ${daysUntil <= 3 ? "text-red-600" : "text-zinc-700"}`}
                >
                  あと {daysUntil} 日
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
