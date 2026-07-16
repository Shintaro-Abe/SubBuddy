import { authenticateRequest } from "@/lib/auth";
import { ok, serverError, unauthorized } from "@/lib/api";
import { listSubscriptions } from "@/repositories/subscriptions";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";

export const dynamic = "force-dynamic";

/** 月額/年額合計・件数（アクティブな契約のみ）。functional-design §10。 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    const subs = await listSubscriptions(auth.actor.userId);
    const active = subs.filter((s) => s.status === "active");

    let monthlyTotal = 0;
    let yearlyTotal = 0;
    for (const s of active) {
      monthlyTotal += toMonthlyAmount(s.amount, s.billingCycle);
      yearlyTotal += toYearlyAmount(s.amount, s.billingCycle);
    }

    return ok({
      activeCount: active.length,
      totalCount: subs.length,
      monthlyTotal,
      yearlyTotal,
      currency: "JPY",
    });
  } catch {
    return serverError();
  }
}
