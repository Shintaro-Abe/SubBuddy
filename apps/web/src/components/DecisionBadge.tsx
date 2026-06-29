import type { RecommendationSnapshot } from "@prisma/client";
import { DECISION_DOT_CLASS, DECISION_LABEL } from "@/lib/display";

/**
 * 判定バッジ（ドット＋ラベル形式・design.css）。
 * 観測中（data_status=observing）は「観測中 あと N 日」を専用表示する（§8.5 / glossary）。
 * 判定がまだ無い（未計算）場合は「未判定」を表示。警告赤は強い解約候補のみ。
 */
export function DecisionBadge({
  recommendation,
}: {
  recommendation: Pick<
    RecommendationSnapshot,
    "decision" | "dataStatus" | "daysUntilReady"
  > | null;
}) {
  if (!recommendation) {
    return (
      <span className="badge b-observe">
        <span className="dot" />
        未判定
      </span>
    );
  }

  if (recommendation.dataStatus === "observing") {
    return (
      <span className="badge b-observe">
        <span className="dot" />
        観測中 あと {recommendation.daysUntilReady} 日
      </span>
    );
  }

  if (recommendation.decision) {
    return (
      <span className={`badge ${DECISION_DOT_CLASS[recommendation.decision]}`}>
        <span className="dot" />
        {DECISION_LABEL[recommendation.decision]}
      </span>
    );
  }

  return (
    <span className="badge b-observe">
      <span className="dot" />
      未判定
    </span>
  );
}
