import Link from "next/link";
import { requireServerUserId } from "@/lib/server-auth";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { daysUntil, formatDate, formatYen } from "@/lib/display";
import { DecisionBadge } from "@/components/DecisionBadge";
import { ScreenIntro } from "@/components/ScreenIntro";

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

  const rows = await getSubscriptionsWithLatestRecommendation(await requireServerUserId());
  const upcoming = rows
    .filter((r) => r.subscription.status === "active" && r.subscription.nextRenewalDate)
    .map((r) => ({ ...r, daysUntil: daysUntil(r.subscription.nextRenewalDate) ?? -1 }))
    .filter((r) => r.daysUntil >= 0 && r.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const DAY_OPTIONS = [7, 14, 30];

  return (
    <div>
      <p className="display">更新間近</p>
      <p className="caption" style={{ marginTop: 8 }}>
        更新日が近い契約を、更新前に見直せます。
      </p>
      <ScreenIntro screen="renewals">
        更新日を登録済みの契約だけを表示します。表示されない契約は、契約画面で更新日を確認できます。
      </ScreenIntro>

      <div className="seg" style={{ margin: "18px 0 6px" }}>
        {DAY_OPTIONS.map((opt) => (
          <Link
            key={opt}
            href={`/renewals?days=${opt}`}
            className={`opt${opt === days ? " sel" : ""}`}
          >
            {opt}日以内
          </Link>
        ))}
      </div>

      {upcoming.length === 0 ? (
        <div className="panel" style={{ marginTop: 10 }}>
          <p className="caption" style={{ margin: 0 }}>
            {days} 日以内に更新予定の契約はありません。
          </p>
        </div>
      ) : (
        <div className="panel mobile-card-list" style={{ padding: "6px 18px", marginTop: 10 }}>
          {upcoming.map(({ subscription: s, recommendation: rec, reviewBlocked, daysUntil }) => (
            <Link
              key={s.id}
              href={`/subscriptions/${s.id}`}
              className="rowitem"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="left">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="body" style={{ fontWeight: 700 }}>
                      {s.name}
                    </span>
                    <DecisionBadge recommendation={rec} blocked={reviewBlocked} />
                  </div>
                  <div className="caption" style={{ margin: "2px 0 0" }}>
                    {formatDate(s.nextRenewalDate)} 更新・
                    <span className="num">{formatYen(s.amount)}</span>
                  </div>
                </div>
              </div>
              <span className={`daysbadge${daysUntil <= 3 ? " soon" : ""}`}>
                あと<span className="num">{daysUntil}</span>日
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
