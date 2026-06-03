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
