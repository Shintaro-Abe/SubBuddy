import { verifyStaticBearerToken } from "@/lib/auth";

/**
 * local mode の利用量同期 API（POST /api/usage/daily）用トークン検証。
 * `USAGE_SYNC_TOKEN` は cloud-testflight / production の主認証ではなく、local mode 用の互換手段。
 */
export function verifyUsageSyncToken(
  authorizationHeader: string | null,
  expectedToken: string | undefined,
): boolean {
  return verifyStaticBearerToken(authorizationHeader, expectedToken);
}
