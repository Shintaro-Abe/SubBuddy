import { authenticateRequest } from "@/lib/auth";
import { ok, serverError, unauthorized } from "@/lib/api";
import { listLatestRecommendations } from "@/repositories/recommendations";

export const dynamic = "force-dynamic";

/** サブスクごとの最新スナップショット一覧。functional-design §10。 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    const items = await listLatestRecommendations(auth.actor.userId);
    return ok({ items });
  } catch {
    return serverError();
  }
}
