import { getCurrentUserId } from "@/lib/user";
import { ok, fromZodError, badRequest, serverError } from "@/lib/api";
import { usageDailyBatchSchema } from "@/schemas/usage";
import { normalizeUsageBatch } from "@/domain/usage/normalize";
import { upsertUsageDailyBatch } from "@/repositories/usage";

export const dynamic = "force-dynamic";

/**
 * 利用量同期（iOS の集計値のみ）。Zod 検証 → 整形 → 冪等 upsert。
 * 同一バッチを再送しても行は増えない（subscription_id × usage_date）。
 */
export async function POST(req: Request) {
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
