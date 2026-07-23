import type { RecommendationSnapshot, Subscription } from "@prisma/client";
import { listSubscriptions } from "@/repositories/subscriptions";
import { listLatestRecommendationsForDisplay } from "@/repositories/recommendations";

/**
 * サーバーコンポーネント用の読み取り合成。
 * サブスクと「サブスクごとの最新スナップショット」を突き合わせて返す。
 */
export interface SubscriptionWithRecommendation {
  subscription: Subscription;
  recommendation: RecommendationSnapshot | null;
  reviewBlocked: boolean;
}

export async function getSubscriptionsWithLatestRecommendation(
  userId: string,
): Promise<SubscriptionWithRecommendation[]> {
  const [subs, recs] = await Promise.all([
    listSubscriptions(userId),
    listLatestRecommendationsForDisplay(userId),
  ]);
  const byId = new Map(recs.items.map((r) => [r.subscriptionId, r]));
  const blockedIds = new Set(recs.blockedItems.map((item) => item.subscriptionId));
  return subs.map((subscription) => ({
    subscription,
    recommendation: byId.get(subscription.id) ?? null,
    reviewBlocked: blockedIds.has(subscription.id),
  }));
}
