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
    // 未検証の計算途中データを返さず、表示は安全検査済みのGETから取得させる。
    return ok({ recomputed: results.length });
  } catch {
    return serverError();
  }
}
