import type { ReviewPriority } from "@prisma/client";
import { REVIEW_PRIORITY_LABEL } from "@/domain/review/output";

export { REVIEW_PRIORITY_LABEL };

export const REVIEW_PRIORITY_DOT_CLASS: Record<ReviewPriority, string> = {
  now: "b-strong",
  before_renewal: "b-review",
  missing_information: "b-observe",
  low_urgency: "b-keep",
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
 * 指定日から今日までの経過日数。未指定・不正・未来日は null。
 * 現在時刻（Date.now）に依存するため、コンポーネント描画内ではなく
 * このユーティリティ層で読む（描画の純粋性・ハイドレーション一致を保つ）。
 */
export function daysSince(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return diff >= 0 ? diff : null;
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
