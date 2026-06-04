import { USAGE_BUCKET_LOWER_MINUTES, type UsageBucketWire } from "@/lib/usage-bucket";

/**
 * 利用量の集計（純関数・副作用なし）。design §5 / functional-design §8.5。
 *
 * 集計は「登録時点（createdAt）から」始める前提（過去には遡らない）。
 * iOS から来るのは集計値（◯分以上のバケット）のみで、詳細ログは扱わない。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyUsagePoint {
  /** その日の利用サマリの日付（日単位）。 */
  usageDate: Date;
  /** その日に利用したか。 */
  used: boolean;
  /** 利用量バケット（ワイヤ形式）。 */
  usageBucket: UsageBucketWire;
}

export interface UsageAggregate {
  /** 登録（createdAt）から asOf までの観測日数（0 以上）。 */
  observationDays: number;
  /** 直近 windowDays 日のうち利用した日数。 */
  usageDays30d: number;
  /** 直近 windowDays 日の利用分数の見積り合計（バケット下限の総和）。 */
  usageMinutes30d: number;
  /** 最終利用からの日数。一度も利用がなければ null。 */
  daysSinceLastUse: number | null;
}

/** 2 つの日付の差を「日数（切り捨て・0 以上）」で返す。 */
function diffInDays(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function aggregateUsage(args: {
  /** サブスク登録日時（集計の起点）。 */
  createdAt: Date;
  /** 集計の基準時刻（「今」）。テスト容易性のため引数で受ける。 */
  asOf: Date;
  /** 集計対象期間（日数。既定の利用は config.usageWindowDays=30）。 */
  windowDays: number;
  /** 利用サマリ（順不同で可）。 */
  points: DailyUsagePoint[];
}): UsageAggregate {
  const { createdAt, asOf, windowDays, points } = args;

  const observationDays = diffInDays(createdAt, asOf);

  let usageDays30d = 0;
  let usageMinutes30d = 0;
  let daysSinceLastUse: number | null = null;

  for (const p of points) {
    if (!p.used) continue;
    const ageDays = diffInDays(p.usageDate, asOf);

    // 最終利用からの日数は全履歴から最小（最も新しい利用日）を採る。
    if (daysSinceLastUse === null || ageDays < daysSinceLastUse) {
      daysSinceLastUse = ageDays;
    }

    // 直近 windowDays 日の集計（[0, windowDays)）。
    if (ageDays < windowDays) {
      usageDays30d += 1;
      usageMinutes30d += USAGE_BUCKET_LOWER_MINUTES[p.usageBucket];
    }
  }

  return { observationDays, usageDays30d, usageMinutes30d, daysSinceLastUse };
}
