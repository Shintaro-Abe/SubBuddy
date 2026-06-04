import type { RecommendationSnapshot } from "@prisma/client";
import {
  DECISION_BADGE_CLASS,
  DECISION_LABEL,
  OBSERVING_BADGE_CLASS,
} from "@/lib/display";

/**
 * 判定バッジ。観測中（data_status=observing）は「観測中 あと N 日」を専用表示する（§8.5 / glossary）。
 * 判定がまだ無い（未計算）場合は「未判定」を表示。
 */
export function DecisionBadge({
  recommendation,
}: {
  recommendation: Pick<
    RecommendationSnapshot,
    "decision" | "dataStatus" | "daysUntilReady"
  > | null;
}) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

  if (!recommendation) {
    return <span className={`${base} ${OBSERVING_BADGE_CLASS}`}>未判定</span>;
  }

  if (recommendation.dataStatus === "observing") {
    return (
      <span className={`${base} ${OBSERVING_BADGE_CLASS}`}>
        観測中 あと {recommendation.daysUntilReady} 日
      </span>
    );
  }

  if (recommendation.decision) {
    return (
      <span className={`${base} ${DECISION_BADGE_CLASS[recommendation.decision]}`}>
        {DECISION_LABEL[recommendation.decision]}
      </span>
    );
  }

  return <span className={`${base} ${OBSERVING_BADGE_CLASS}`}>未判定</span>;
}
