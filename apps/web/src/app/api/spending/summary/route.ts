import { authenticateRequest } from "@/lib/auth";
import { ok, serverError, unauthorized } from "@/lib/api";
import { listSubscriptions } from "@/repositories/subscriptions";
import { aggregateSpending } from "@/domain/spending/aggregate";

export const dynamic = "force-dynamic";

/**
 * 支出サマリ（月額/年額合計・カテゴリ別内訳・月次推移）。
 * 集計は domain/spending に集約し、ここは取得と整形のみ。
 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    const subs = await listSubscriptions(auth.actor.userId);
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
