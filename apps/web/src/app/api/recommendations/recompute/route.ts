import { parseAuthConfig } from "@/config/auth";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { recomputeRecommendations } from "@/services/recompute";

export const dynamic = "force-dynamic";

/** 全件再スコアリングして履歴に追記し、結果を返す。functional-design §10。 */
export async function POST(req: Request) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode !== "local" && !authorizeStateChange(req, auth, config)) return forbidden();
    const results = await recomputeRecommendations(auth.actor.userId);
    return ok({ recomputed: results.length, items: results });
  } catch {
    return serverError();
  }
}
