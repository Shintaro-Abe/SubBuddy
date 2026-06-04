import { aggregateUsage } from "@/domain/usage/aggregate";
import { computeRecommendation, type RecommendationResult } from "@/domain/scoring/computeRecommendation";
import { defaultScoringConfig, type ScoringConfig } from "@/config/scoring";
import { toUsageBucketWire } from "@/lib/usage-bucket";
import { listSubscriptions } from "@/repositories/subscriptions";
import { listUsageForSubscription } from "@/repositories/usage";
import { appendRecommendationSnapshot } from "@/repositories/recommendations";

/**
 * レコメンド再計算の orchestration（アプリケーションサービス）。
 * 「集計（domain/usage）→ 同カテゴリ重複の判定 → スコアリング（domain/scoring）→ 履歴保存（repositories）」を束ねる。
 * ドメインは純関数のまま保ち、I/O はリポジトリに限定する（design §1）。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecomputeResultItem extends RecommendationResult {
  subscriptionId: string;
  name: string;
}

/** asOf から未来日（renewal）までの残り日数。過去なら負値。null は null のまま。 */
function daysUntil(asOf: Date, target: Date | null): number | null {
  if (!target) return null;
  return Math.floor((target.getTime() - asOf.getTime()) / DAY_MS);
}

export async function recomputeRecommendations(
  userId: string,
  config: ScoringConfig = defaultScoringConfig,
  asOf: Date = new Date(),
): Promise<RecomputeResultItem[]> {
  const subs = await listSubscriptions(userId);

  // 1) サブスクごとに利用集計（重複の「低利用側」判定にも使う）。
  const aggregates = new Map<string, ReturnType<typeof aggregateUsage>>();
  const hasUsageData = new Map<string, boolean>();
  for (const s of subs) {
    const usage = await listUsageForSubscription(userId, s.id);
    hasUsageData.set(s.id, usage.length > 0);
    aggregates.set(
      s.id,
      aggregateUsage({
        createdAt: s.createdAt,
        asOf,
        windowDays: config.usageWindowDays,
        points: usage.map((u) => ({
          usageDate: u.usageDate,
          used: u.used,
          usageBucket: toUsageBucketWire(u.usageBucket),
        })),
      }),
    );
  }

  // 2) 同カテゴリ重複の判定。アクティブな契約のみ対象に、
  //    カテゴリ内の最大利用日数より少ない契約を「低利用側」とする。
  const overlap = new Set<string>();
  const lowerUsage = new Set<string>();
  const byCategory = new Map<string, typeof subs>();
  for (const s of subs) {
    if (s.status !== "active") continue;
    const arr = byCategory.get(s.category) ?? [];
    arr.push(s);
    byCategory.set(s.category, arr);
  }
  for (const arr of byCategory.values()) {
    if (arr.length < 2) continue;
    const maxDays = Math.max(...arr.map((s) => aggregates.get(s.id)!.usageDays30d));
    for (const s of arr) {
      overlap.add(s.id);
      if (aggregates.get(s.id)!.usageDays30d < maxDays) lowerUsage.add(s.id);
    }
  }

  // 3) スコアリング → スナップショット追記。
  const results: RecomputeResultItem[] = [];
  for (const s of subs) {
    const agg = aggregates.get(s.id)!;
    const result = computeRecommendation(
      {
        amount: s.amount,
        billingCycle: s.billingCycle,
        importance: s.importance,
        observationDays: agg.observationDays,
        usageDays30d: agg.usageDays30d,
        usageMinutes30d: agg.usageMinutes30d,
        daysSinceLastUse: agg.daysSinceLastUse,
        hasUsageData: hasUsageData.get(s.id)!,
        daysUntilRenewal: daysUntil(asOf, s.nextRenewalDate),
        hasCategoryOverlap: overlap.has(s.id),
        isLowerUsageInOverlap: lowerUsage.has(s.id),
      },
      config,
    );
    await appendRecommendationSnapshot(userId, s.id, result);
    results.push({ subscriptionId: s.id, name: s.name, ...result });
  }
  return results;
}
