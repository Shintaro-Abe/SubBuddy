import { ok, fromZodError, badRequest, serverError, unauthorized, notFound } from "@/lib/api";
import {
  authenticateDeviceSyncToken,
  getLocalActor,
  touchDeviceLastSyncedAt,
  type AuthenticatedActor,
} from "@/lib/auth";
import { verifyUsageSyncToken } from "@/lib/usage-auth";
import { usageDailyBatchSchema } from "@/schemas/usage";
import { normalizeUsageBatch } from "@/domain/usage/normalize";
import { upsertUsageDailyBatch, UsageSubscriptionNotFoundError } from "@/repositories/usage";
import { parseAuthConfig } from "@/config/auth";
import { refreshRecommendationAfterMutation } from "@/services/recompute";

export const dynamic = "force-dynamic";

async function authenticateUsageSyncRequest(req: Request): Promise<AuthenticatedActor | null> {
  const authorization = req.headers.get("authorization");
  const config = parseAuthConfig();

  if (config.mode === "local") {
    return verifyUsageSyncToken(authorization, process.env.USAGE_SYNC_TOKEN)
      ? getLocalActor()
      : null;
  }
  return authenticateDeviceSyncToken(authorization);
}

/**
 * 利用量同期（iOS の集計値のみ）。認証 → Zod 検証 → 整形 → 冪等 upsert。
 * local mode は USAGE_SYNC_TOKEN、cloud-testflight / production は device token auth で user_id を解決する。
 */
export async function POST(req: Request) {
  let actor: AuthenticatedActor | null;
  try {
    actor = await authenticateUsageSyncRequest(req);
  } catch {
    return serverError();
  }
  if (!actor) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }
  const parsed = usageDailyBatchSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const normalized = normalizeUsageBatch(parsed.data.items);
    const result = await upsertUsageDailyBatch(actor.userId, normalized);
    const subscriptionIds = [...new Set(normalized.map((item) => item.subscriptionId))];
    await Promise.all(
      subscriptionIds.map((subscriptionId) =>
        refreshRecommendationAfterMutation(actor.userId, subscriptionId),
      ),
    );
    if (actor.kind === "device") {
      await touchDeviceLastSyncedAt(actor.deviceId);
    }
    return ok(result);
  } catch (error) {
    if (error instanceof UsageSubscriptionNotFoundError) return notFound();
    return serverError();
  }
}
