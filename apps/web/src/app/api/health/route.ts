import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Render 起動確認用の軽量ヘルスチェック。
 * DB・Apple 設定・secret の値は返さない。
 */
export function GET() {
  return ok({
    ok: true,
    mode: process.env.SUBBUDDY_MODE ?? "local",
  });
}
