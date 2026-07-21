import Link from "next/link";
import { requireServerUserId } from "@/lib/server-auth";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { ScreenIntro } from "@/components/ScreenIntro";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(await requireServerUserId());

  return (
    <div>
      <div className="pagehead subscriptions-pagehead flex items-end justify-between gap-4">
        <div>
          <p className="display">契約</p>
          <p className="caption" style={{ marginTop: 8 }}>
            継続中 <span className="num">{rows.length}</span> 件
          </p>
        </div>
        <Link href="/subscriptions/new" className="btn subscription-add-button">
          <span className="desktop-only">＋ サブスクを登録</span>
          <span className="mobile-only">＋ 追加</span>
        </Link>
      </div>
      <ScreenIntro screen="subscriptions">
        ここに登録した契約だけが、支出集計と見直しの対象になります。思い出せる範囲から追加できます。
      </ScreenIntro>

      {rows.length === 0 ? (
        <div className="panel" style={{ marginTop: 24 }}>
          <p className="body">まだ登録している契約はありません。</p>
          <p className="caption" style={{ marginTop: 8 }}>
            思い出せるものから、最初の契約を追加してみましょう。
          </p>
          <Link href="/subscriptions/new" className="btn mobile-block" style={{ marginTop: 16 }}>
            最初の契約を追加
          </Link>
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
