import { getCurrentUserId } from "@/lib/user";
import { ok, fromZodError, badRequest, serverError, unauthorized } from "@/lib/api";
import { verifyUsageSyncToken } from "@/lib/usage-auth";
import { usageDailyBatchSchema } from "@/schemas/usage";
import { normalizeUsageBatch } from "@/domain/usage/normalize";
import { upsertUsageDailyBatch } from "@/repositories/usage";

export const dynamic = "force-dynamic";

/**
 * 利用量同期（iOS の集計値のみ）。トークン検証 → Zod 検証 → 整形 → 冪等 upsert。
 * 同一バッチを再送しても行は増えない（subscription_id × usage_date）。
 * 認証は事前共有トークン（architecture §8.1.1）。USAGE_SYNC_TOKEN 未設定時は常に 401。
 */
export async function POST(req: Request) {
  if (!verifyUsageSyncToken(req.headers.get("authorization"), process.env.USAGE_SYNC_TOKEN)) {
    return unauthorized();
  }

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
    const result = await upsertUsageDailyBatch(getCurrentUserId(), normalized);
    return ok(result);
  } catch {
    return serverError();
  }
}
