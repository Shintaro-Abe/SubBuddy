import { UsageBucket } from "@prisma/client";
import { toUsageBucketEnum } from "@/lib/usage-bucket";
import type { UsageDailyItemInput } from "@/schemas/usage";

/**
 * 利用量同期ペイロード（Zod 検証済み・ワイヤ形式）を、永続化用の形へ整形する純関数。
 * design §1：取り込みは「同期 API → 整形（normalize）→ 保存」の一本道。
 * 2 例目の取得源が出た時点で ingestion/ へ移設する。
 */
export interface NormalizedUsageDaily {
  subscriptionId: string;
  /** 日付文字列（YYYY-MM-DD）を UTC 0 時の Date に固定。 */
  usageDate: Date;
  used: boolean;
  usageBucket: UsageBucket;
  estimatedMinutesMin: number | null;
  estimatedMinutesMax: number | null;
  source: string;
}

export function normalizeUsageDaily(item: UsageDailyItemInput): NormalizedUsageDaily {
  return {
    subscriptionId: item.subscriptionId,
    usageDate: new Date(`${item.date}T00:00:00.000Z`),
    used: item.used,
    usageBucket: toUsageBucketEnum(item.usageBucket),
    estimatedMinutesMin: item.estimatedMinutesMin ?? null,
    estimatedMinutesMax: item.estimatedMinutesMax ?? null,
    source: item.source,
  };
}

export function normalizeUsageBatch(items: UsageDailyItemInput[]): NormalizedUsageDaily[] {
  return items.map(normalizeUsageDaily);
}
