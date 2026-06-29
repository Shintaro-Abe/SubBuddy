import { ok, serverError } from "@/lib/api";
import { listServiceCatalog } from "@/repositories/service-catalog";

export const dynamic = "force-dynamic";

/** 正規化辞書・除外サービス一覧。functional-design §10。 */
export async function GET() {
  try {
    const items = await listServiceCatalog();
    return ok({ items });
  } catch {
    return serverError();
  }
}
