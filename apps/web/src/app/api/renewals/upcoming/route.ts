import { getCurrentUserId } from "@/lib/user";
import { ok, serverError } from "@/lib/api";
import { listSubscriptions } from "@/repositories/subscriptions";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 14;
const MAX_DAYS = 365;

/** 更新間近の契約一覧。クエリ days（既定14・1..365）。functional-design §10。 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("days"));
  const days =
    Number.isInteger(raw) && raw >= 1 && raw <= MAX_DAYS ? raw : DEFAULT_DAYS;

  try {
    const now = new Date();
    const subs = await listSubscriptions(getCurrentUserId());
    const items = subs
      .filter((s) => s.status === "active" && s.nextRenewalDate)
      .map((s) => ({
        ...s,
        daysUntilRenewal: Math.floor((s.nextRenewalDate!.getTime() - now.getTime()) / DAY_MS),
      }))
      .filter((s) => s.daysUntilRenewal >= 0 && s.daysUntilRenewal <= days)
      .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

    return ok({ days, items });
  } catch {
    return serverError();
  }
}
