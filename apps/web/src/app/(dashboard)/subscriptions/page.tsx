import Link from "next/link";
import { getCurrentUserId } from "@/lib/user";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { SubscriptionCard } from "@/components/SubscriptionCard";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(getCurrentUserId());

  return (
    <div>
      <div className="pagehead flex items-end justify-between gap-4">
        <div>
          <p className="display">サブスク一覧</p>
          <p className="caption" style={{ marginTop: 8 }}>
            継続中 <span className="num">{rows.length}</span> 件
          </p>
        </div>
        <Link href="/subscriptions/new" className="btn">
          ＋ サブスクを登録
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="panel" style={{ marginTop: 24 }}>
          <p className="body">まだ登録しているサブスクはありません。</p>
          <p className="caption" style={{ marginTop: 8 }}>
            「＋ サブスクを登録」から最初の契約を追加してみましょう。
          </p>
        </div>
      ) : (
        <div className="cards" style={{ marginTop: 24 }}>
          {rows.map((row) => (
            <SubscriptionCard key={row.subscription.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
