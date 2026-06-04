import Link from "next/link";
import { getCurrentUserId } from "@/lib/user";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { SubscriptionCard } from "@/components/SubscriptionCard";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(getCurrentUserId());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">サブスク一覧（{rows.length} 件）</h1>
        <Link
          href="/subscriptions/new"
          className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + 登録
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md bg-zinc-100 p-4 text-sm text-zinc-600">
          まだ登録がありません。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <SubscriptionCard key={row.subscription.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
