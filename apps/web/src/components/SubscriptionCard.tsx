import Link from "next/link";
import type { SubscriptionWithRecommendation } from "@/lib/queries";
import { categoryLabel, formatDate, formatYen } from "@/lib/display";
import { DecisionBadge } from "./DecisionBadge";

/**
 * 一覧で使うサブスクカード。クラス重複を避けるため共通化（T6-7）。
 */
export function SubscriptionCard({ row }: { row: SubscriptionWithRecommendation }) {
  const { subscription: s, recommendation: rec, reviewBlocked } = row;
  const cycleLabel = s.billingCycle === "yearly" ? "/年" : "/月";

  return (
    <Link href={`/subscriptions/${s.id}`} className="scard">
      <div className="row1">
        <div>
          <div className="nm">{s.name}</div>
          <div className="ct">{categoryLabel(s.category)}</div>
        </div>
        <DecisionBadge recommendation={rec} blocked={reviewBlocked} />
      </div>
      <div className="price">
        {formatYen(s.amount)} <small>{cycleLabel}</small>
      </div>
      <div className="meta">
        <span>次回更新 {formatDate(s.nextRenewalDate)}</span>
        {rec && rec.dataStatus === "ready" && (
          <span>
            30日 / <span className="num">{rec.usageDays30d}</span>日利用
          </span>
        )}
      </div>
    </Link>
  );
}
