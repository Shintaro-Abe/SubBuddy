import { getCurrentUserId } from "@/lib/user";
import { ok, serverError } from "@/lib/api";
import { listLatestRecommendations } from "@/repositories/recommendations";

export const dynamic = "force-dynamic";

/** サブスクごとの最新スナップショット一覧。functional-design §10。 */
export async function GET() {
  try {
    const items = await listLatestRecommendations(getCurrentUserId());
    return ok({ items });
  } catch {
    return serverError();
  }
}
