import { parseAuthConfig } from "@/config/auth";
import { forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { deleteMeasurementData } from "@/repositories/measurement-data";
import { refreshRecommendationAfterMutation } from "@/services/recompute";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode !== "local" && !authorizeStateChange(req, auth, config)) return forbidden();

    const deleted = await deleteMeasurementData(auth.actor.userId, id);
    if (!deleted) return notFound();

    // 対象契約の古い根拠を復活させないため、削除済み利用量を使わず単件再計算する。
    await refreshRecommendationAfterMutation(auth.actor.userId, id);
    return ok({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/subscriptions/[id]/usage failed", error);
    return serverError();
  }
}
