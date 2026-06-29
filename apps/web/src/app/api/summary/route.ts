import { getCurrentUserId } from "@/lib/user";
import { ok, serverError } from "@/lib/api";
import { listSubscriptions } from "@/repositories/subscriptions";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";

export const dynamic = "force-dynamic";

/** 月額/年額合計・件数（アクティブな契約のみ）。functional-design §10。 */
export async function GET() {
  try {
    const subs = await listSubscriptions(getCurrentUserId());
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
