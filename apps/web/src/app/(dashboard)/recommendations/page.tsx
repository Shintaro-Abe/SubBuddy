import Link from "next/link";
import type { ReviewPriority } from "@prisma/client";
import { requireServerUserId } from "@/lib/server-auth";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import {
  REVIEW_PRIORITY_DOT_CLASS,
  REVIEW_PRIORITY_LABEL,
  formatYen,
} from "@/lib/display";
import { RecomputeButton } from "@/components/RecomputeButton";
import { ScreenIntro } from "@/components/ScreenIntro";

export const dynamic = "force-dynamic";

const ORDER: ReviewPriority[] = [
  "now",
  "before_renewal",
  "missing_information",
  "low_urgency",
];

export default async function RecommendationsPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(await requireServerUserId());
  const blocked = rows.filter((r) => r.reviewBlocked);
  const unjudged = rows.filter((r) => !r.recommendation && !r.reviewBlocked);

  const groups = ORDER.map((priority) => ({
    priority,
    items: rows.filter((r) => r.recommendation?.reviewPriority === priority),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="recommendations-pagehead flex items-center justify-between gap-4">
        <p className="display">見直し</p>
        <RecomputeButton />
      </div>
      <p className="caption" style={{ marginTop: 8 }}>
        確認する順番ごとに表示します。最終的な判断はご自身で行えます。
      </p>
      <ScreenIntro screen="review">
        解約を決める画面ではありません。分かっている事実、足りない情報、選択肢を確認する場所です。
      </ScreenIntro>

      {rows.length > 0 && groups.length === 0 && blocked.length === 0 && (
        <p className="panel caption" style={{ marginTop: 24, padding: 16 }}>
          見直し情報はまだありません。「見直し材料を再計算」を実行してください。
        </p>
      )}

      {groups.map((g) => (
        <section key={g.priority} style={{ marginTop: 28 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span className={`badge ${REVIEW_PRIORITY_DOT_CLASS[g.priority]}`}>
              <span className="dot" />
            </span>
            <span className="title" style={{ fontSize: 18 }}>
              {REVIEW_PRIORITY_LABEL[g.priority]}
            </span>
            <span className="caption num" style={{ margin: 0 }}>
              {g.items.length} 件
            </span>
          </div>
          <div className="panel mobile-card-list" style={{ padding: "4px 16px" }}>
            {g.items.map(({ subscription: s, recommendation: rec }) => (
              <Link key={s.id} href={`/subscriptions/${s.id}`} className="rowitem">
                <div className="min-w-0">
                  <div className="review-card-name font-medium">{s.name}</div>
                  <div className="caption mobile-line-clamp" style={{ margin: "2px 0 0" }}>
                    {rec!.reason}
                  </div>
                </div>
                <div className="num shrink-0 text-right">{formatYen(rec!.monthlyAmount)} /月</div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {blocked.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span className="badge b-observe">
              <span className="dot" />
            </span>
            <span className="title" style={{ fontSize: 18 }}>
              再計算が必要
            </span>
            <span className="caption num" style={{ margin: 0 }}>
              {blocked.length} 件
            </span>
          </div>
          <div className="panel mobile-card-list" style={{ padding: "4px 16px" }}>
            {blocked.map(({ subscription: s }) => (
              <Link key={s.id} href={`/subscriptions/${s.id}`} className="rowitem">
                <div className="min-w-0">
                  <div className="review-card-name font-medium">{s.name}</div>
                  <div className="caption" style={{ margin: "2px 0 0" }}>
                    古い内容は表示していません。見直し材料を再計算してください。
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {unjudged.length > 0 && (
        <p className="caption" style={{ marginTop: 24 }}>
          未計算 <span className="num">{unjudged.length}</span> 件（再計算で見直し材料を作成します）
        </p>
      )}
    </div>
  );
}
