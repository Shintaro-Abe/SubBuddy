import Link from "next/link";
import type { Decision } from "@prisma/client";
import { requireServerUserId } from "@/lib/server-auth";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { DECISION_DOT_CLASS, DECISION_LABEL, formatYen } from "@/lib/display";
import { RecomputeButton } from "@/components/RecomputeButton";
import { ScreenIntro } from "@/components/ScreenIntro";

export const dynamic = "force-dynamic";

const ORDER: Decision[] = [
  "strong_cancel_candidate",
  "consider_cancel",
  "consider_downgrade",
  "review",
  "keep",
];

export default async function RecommendationsPage() {
  const rows = await getSubscriptionsWithLatestRecommendation(await requireServerUserId());
  const ready = rows.filter((r) => r.recommendation?.dataStatus === "ready");
  const observing = rows.filter((r) => r.recommendation?.dataStatus === "observing");
  const unjudged = rows.filter((r) => !r.recommendation);

  const groups = ORDER.map((decision) => ({
    decision,
    items: ready.filter((r) => r.recommendation?.decision === decision),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="recommendations-pagehead flex items-center justify-between gap-4">
        <p className="display">見直し</p>
        <RecomputeButton />
      </div>
      <p className="caption" style={{ marginTop: 8 }}>
        判定ごとに分けて表示。根拠をもとに、続けるか見直すかはご自身で判断できます。
      </p>
      <ScreenIntro screen="review">
        解約を決める画面ではありません。分かっている事実、足りない情報、選択肢を確認する場所です。
      </ScreenIntro>

      {rows.length > 0 && groups.length === 0 && observing.length === 0 && (
        <p className="panel caption" style={{ marginTop: 24, padding: 16 }}>
          まだ判定がありません。「判定を再計算」を実行してください。
        </p>
      )}

      {groups.map((g) => (
        <section key={g.decision} style={{ marginTop: 28 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span className={`badge ${DECISION_DOT_CLASS[g.decision]}`}>
              <span className="dot" />
            </span>
            <span className="title" style={{ fontSize: 18 }}>
              {DECISION_LABEL[g.decision]}
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

      {observing.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span className="badge b-observe">
              <span className="dot" />
            </span>
            <span className="title" style={{ fontSize: 18 }}>
              観測中
            </span>
            <span className="caption num" style={{ margin: 0 }}>
              {observing.length} 件
            </span>
          </div>
          <div className="panel mobile-card-list" style={{ padding: "4px 16px" }}>
            {observing.map(({ subscription: s, recommendation: rec }) => (
              <Link key={s.id} href={`/subscriptions/${s.id}`} className="rowitem">
                <div className="min-w-0">
                  <div className="review-card-name font-medium">{s.name}</div>
                  <div className="caption" style={{ margin: "2px 0 0" }}>
                    確定まであと <span className="num">{rec!.daysUntilReady}</span> 日
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {unjudged.length > 0 && (
        <p className="caption" style={{ marginTop: 24 }}>
          未判定 <span className="num">{unjudged.length}</span> 件（再計算で判定されます）
        </p>
      )}
    </div>
  );
}
