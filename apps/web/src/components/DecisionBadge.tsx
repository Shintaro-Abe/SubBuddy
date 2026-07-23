import type { RecommendationSnapshot } from "@prisma/client";
import { REVIEW_PRIORITY_DOT_CLASS, REVIEW_PRIORITY_LABEL } from "@/lib/display";

/**
 * 利用者向け確認優先度のバッジ。内部 decision は表示に使わない。
 */
export function DecisionBadge({
  recommendation,
  blocked = false,
}: {
  recommendation: Pick<
    RecommendationSnapshot,
    "reviewPriority"
  > | null;
  blocked?: boolean;
}) {
  if (blocked) {
    return (
      <span className="badge b-observe">
        <span className="dot" />
        再計算が必要
      </span>
    );
  }
  if (!recommendation) {
    return (
      <span className="badge b-observe">
        <span className="dot" />
        未計算
      </span>
    );
  }

  if (recommendation.reviewPriority) {
    return (
      <span className={`badge ${REVIEW_PRIORITY_DOT_CLASS[recommendation.reviewPriority]}`}>
        <span className="dot" />
        {REVIEW_PRIORITY_LABEL[recommendation.reviewPriority]}
      </span>
    );
  }

  return (
    <span className="badge b-observe">
      <span className="dot" />
      再計算が必要
    </span>
  );
}
