import { getCurrentUserId } from "@/lib/user";
import { ok, serverError } from "@/lib/api";
import { listSubscriptions } from "@/repositories/subscriptions";
import { aggregateSpending } from "@/domain/spending/aggregate";

export const dynamic = "force-dynamic";

/**
 * 支出サマリ（月額/年額合計・カテゴリ別内訳・月次推移）。
 * 集計は domain/spending に集約し、ここは取得と整形のみ。
 */
export async function GET() {
  try {
    const subs = await listSubscriptions(getCurrentUserId());
    const summary = aggregateSpending(
      subs.map((s) => ({
        amount: s.amount,
        billingCycle: s.billingCycle,
        category: s.category,
        status: s.status,
        createdAt: s.createdAt,
      })),
      { referenceDate: new Date(), windowMonths: 6 },
    );
    return ok(summary);
  } catch {
    return serverError();
  }
}
