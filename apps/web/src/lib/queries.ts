import type { RecommendationSnapshot, Subscription } from "@prisma/client";
import { listSubscriptions } from "@/repositories/subscriptions";
import { listLatestRecommendations } from "@/repositories/recommendations";

/**
 * サーバーコンポーネント用の読み取り合成。
 * サブスクと「サブスクごとの最新スナップショット」を突き合わせて返す。
 */
export interface SubscriptionWithRecommendation {
  subscription: Subscription;
  recommendation: RecommendationSnapshot | null;
}

export async function getSubscriptionsWithLatestRecommendation(
  userId: string,
): Promise<SubscriptionWithRecommendation[]> {
  const [subs, recs] = await Promise.all([
    listSubscriptions(userId),
    listLatestRecommendations(userId),
  ]);
  const byId = new Map(recs.map((r) => [r.subscriptionId, r]));
  return subs.map((subscription) => ({
    subscription,
    recommendation: byId.get(subscription.id) ?? null,
  }));
}
