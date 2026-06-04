import { getCurrentUserId } from "@/lib/user";
import { ok, serverError } from "@/lib/api";
import { recomputeRecommendations } from "@/services/recompute";

export const dynamic = "force-dynamic";

/** 全件再スコアリングして履歴に追記し、結果を返す。functional-design §10。 */
export async function POST() {
  try {
    const results = await recomputeRecommendations(getCurrentUserId());
    return ok({ recomputed: results.length, items: results });
  } catch {
    return serverError();
  }
}
