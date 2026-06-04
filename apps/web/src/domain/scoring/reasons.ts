import { Decision } from "@prisma/client";

/**
 * 判定理由の定型文（functional-design §8）。AI 生成はせず、テンプレートで組み立てる。
 * 表示ラベルは glossary.md に一致させる（review = 「様子見」）。
 */

export interface ImmediateFlags {
  /** 同カテゴリに他の契約がある（即時の指摘）。 */
  hasCategoryOverlap: boolean;
  /** 更新間近（即時の指摘）。 */
  renewalSoon: boolean;
  /** 更新までの残り日数（分かる場合）。 */
  daysUntilRenewal: number | null;
}

/** 観測中（確定前）の理由文。即時の指摘があれば併記する。 */
export function reasonObserving(daysUntilReady: number, flags: ImmediateFlags): string {
  const parts = [`観測中（利用状況の確定まであと ${daysUntilReady} 日）です`];
  if (flags.hasCategoryOverlap) {
    parts.push("同じカテゴリに他の契約があります");
  }
  if (flags.renewalSoon && flags.daysUntilRenewal !== null) {
    parts.push(`更新まで残り ${flags.daysUntilRenewal} 日です`);
  }
  return parts.join("。") + "。";
}

/** 確定後（ready）の判定理由文。 */
export function reasonForDecision(
  decision: Decision,
  ctx: {
    unusedDays: number;
    usageDays30d: number;
    monthlyAmount: number;
    importance: number;
    hasUsageData?: boolean;
  },
): string {
  // 利用計測データが無い契約（iCloud+ 等の計測対象外）は、利用ベースの判定を保留する。
  if (ctx.hasUsageData === false) {
    return "利用状況のデータがないため、利用ベースの判定は保留します（継続）。";
  }
  switch (decision) {
    case Decision.strong_cancel_candidate:
      return `${ctx.unusedDays} 日間使われていません。解約候補です。`;
    case Decision.consider_cancel:
      return `利用が少なく（直近30日で ${ctx.usageDays30d} 日）、費用に見合っていない可能性があります。解約を検討できます。`;
    case Decision.consider_downgrade:
      return "より安いプランで足りる可能性があります。プランの見直しを検討できます。";
    case Decision.review:
      return `重要度は高めですが利用は少なめ（直近30日で ${ctx.usageDays30d} 日）です。しばらく様子見をおすすめします。`;
    case Decision.keep:
      return "十分に利用されています。継続をおすすめします。";
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}
