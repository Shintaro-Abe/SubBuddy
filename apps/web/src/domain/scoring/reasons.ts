import type { MatchedPattern } from "./computeRecommendation";

/**
 * パターン別の理由文生成（テンプレート方式・AI 不使用）。
 * steering: .steering/20260609-quantitative-recommendation-engine/design.md §5
 */

export function buildReason(patterns: MatchedPattern[]): string {
  if (patterns.length === 0) {
    return "現時点では、急いで確認する材料は見つかっていません。継続をすすめる意味ではありません。";
  }
  const parts = patterns.map((p) => {
    let text = p.evidence;
    if (p.caveat) {
      text += `（※${p.caveat}）`;
    }
    return text;
  });
  return parts.join("。") + "。";
}

export function reasonObserving(
  daysUntilReady: number,
  flags: { hasCategoryOverlap: boolean; renewalSoon: boolean; daysUntilRenewal: number | null },
): string {
  const parts = [`観測中（利用状況の確定まであと ${daysUntilReady} 日）です`];
  if (flags.hasCategoryOverlap) {
    parts.push("同じカテゴリに他の契約があります");
  }
  if (flags.renewalSoon && flags.daysUntilRenewal !== null) {
    parts.push(`更新まで残り ${flags.daysUntilRenewal} 日です`);
  }
  return parts.join("。") + "。";
}
