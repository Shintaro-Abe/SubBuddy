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

/**
 * 判定→ドット色クラス（新デザイン／design.css）。バッジは「ドット＋ラベル」形式で表示する。
 * 警告赤は strong_cancel_candidate のみ（DESIGN.md §2）。observing/未判定は b-observe。
 */
export const DECISION_DOT_CLASS: Record<Decision, string> = {
  keep: "b-keep",
  review: "b-review",
  consider_downgrade: "b-consider",
  consider_cancel: "b-consider",
  strong_cancel_candidate: "b-strong",
};

/**
 * カテゴリ（内部キー）→ 画面表示用の日本語ラベル（DESIGN.md §7：画面の語彙は日本語）。
 * 未知のキーはそのまま返す（データは変更しない・表示のみの変換）。
 */
const CATEGORY_LABEL: Record<string, string> = {
  video_streaming: "動画配信",
  video: "動画",
  music: "音楽",
  productivity: "仕事効率化",
  cloud_storage: "クラウドストレージ",
  storage: "ストレージ",
  vpn: "VPN",
  ebook: "電子書籍",
  audiobook: "オーディオブック",
  dev_tool: "開発ツール",
  creative_tool: "クリエイティブツール",
  ai_tool: "AIツール",
  ai: "AIツール",
  password_manager: "パスワード管理",
  news: "ニュース",
  learning: "学習",
  education: "教育",
  finance: "家計・金融",
  communication: "コミュニケーション",
  membership: "会員サービス",
  game: "ゲーム",
  bundle: "バンドル",
  other: "その他",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

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
