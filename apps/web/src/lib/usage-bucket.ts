import { UsageBucket } from "@prisma/client";

/**
 * 利用バケットの「ワイヤ形式」（API / iOS 集計値・functional-design §5.2）と
 * Prisma enum（数字始まりが使えないため m30_plus 等）の対応。
 * 境界（API 入力）ではワイヤ形式を受け、DB ではこの enum に変換して保存する。
 */
export const USAGE_BUCKET_WIRE = [
  "none",
  "1m_plus",
  "5m_plus",
  "15m_plus",
  "30m_plus",
  "60m_plus",
  "120m_plus",
] as const;

export type UsageBucketWire = (typeof USAGE_BUCKET_WIRE)[number];

const WIRE_TO_ENUM: Record<UsageBucketWire, UsageBucket> = {
  none: UsageBucket.none,
  "1m_plus": UsageBucket.m1_plus,
  "5m_plus": UsageBucket.m5_plus,
  "15m_plus": UsageBucket.m15_plus,
  "30m_plus": UsageBucket.m30_plus,
  "60m_plus": UsageBucket.m60_plus,
  "120m_plus": UsageBucket.m120_plus,
};

const ENUM_TO_WIRE = Object.fromEntries(
  Object.entries(WIRE_TO_ENUM).map(([wire, e]) => [e, wire]),
) as Record<UsageBucket, UsageBucketWire>;

export function toUsageBucketEnum(wire: UsageBucketWire): UsageBucket {
  return WIRE_TO_ENUM[wire];
}

export function toUsageBucketWire(value: UsageBucket): UsageBucketWire {
  return ENUM_TO_WIRE[value];
}

/**
 * バケットの大小比較用ランク（none=0 … 120m_plus=6）。
 * ADR 0006（利用量同期のバケット最大値マージ）で、同一 (subscription_id, usage_date) の
 * 新旧バケットを比較して大きい方を採用するために使う。ワイヤ順を唯一の順序基準にする。
 */
export function usageBucketRank(value: UsageBucket): number {
  return USAGE_BUCKET_WIRE.indexOf(toUsageBucketWire(value));
}

/**
 * 各バケットが表す「最小の利用分数」（下限値）。
 * iOS からは時間そのものではなくバケット（◯分以上）が来るため、
 * 集計では保守的に下限値を採用して「少なくとも何分使ったか」を見積もる。
 */
export const USAGE_BUCKET_LOWER_MINUTES: Record<UsageBucketWire, number> = {
  none: 0,
  "1m_plus": 1,
  "5m_plus": 5,
  "15m_plus": 15,
  "30m_plus": 30,
  "60m_plus": 60,
  "120m_plus": 120,
};
