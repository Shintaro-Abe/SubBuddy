import type { Decision } from "@prisma/client";

/**
 * 画面表示用のラベル・整形ユーティリティ。
 * 判定ラベルは glossary.md に一致させる（review = 「様子見」）。
 */

export const DECISION_LABEL: Record<Decision, string> = {
  keep: "継続",
  review: "様子見",
  consider_downgrade: "ダウングレード検討",
  consider_cancel: "解約検討",
  strong_cancel_candidate: "強い解約候補",
};

/** バッジの配色（Tailwind クラス）。解約寄りほど暖色・強色。 */
export const DECISION_BADGE_CLASS: Record<Decision, string> = {
  keep: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  review: "bg-amber-100 text-amber-800 ring-amber-600/20",
  consider_downgrade: "bg-orange-100 text-orange-800 ring-orange-600/20",
  consider_cancel: "bg-orange-100 text-orange-800 ring-orange-600/20",
  strong_cancel_candidate: "bg-red-100 text-red-800 ring-red-600/20",
};

export const OBSERVING_BADGE_CLASS = "bg-slate-100 text-slate-700 ring-slate-500/20";

/** 整数（最小通貨単位）を ¥1,080 形式に整形。 */
export function formatYen(amount: number): string {
  return `¥${new Intl.NumberFormat("ja-JP").format(amount)}`;
}

/**
 * 現在時刻から対象日までの残り日数（切り捨て）。null は null のまま。
 * 「現在時刻の取得」をコンポーネント外（このユーティリティ）に閉じ込め、描画を純粋に保つ。
 */
export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** ISO 文字列/Date を YYYY-MM-DD 表示に。null は「—」。 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

/**
 * href として安全な URL のみ通す（XSS 対策：javascript: 等を弾く）。
 * http/https 以外は null を返す。
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
