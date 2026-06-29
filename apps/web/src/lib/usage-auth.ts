import { timingSafeEqual } from "node:crypto";

/**
 * 利用量同期 API（POST /api/usage/daily）の事前共有トークン検証（architecture §8.1.1）。
 * iPhone ショートカットが Authorization: Bearer ヘッダで送るトークンを、
 * 環境変数 USAGE_SYNC_TOKEN と比較する。
 *
 * - トークン未設定（環境変数なし）の場合は常に拒否する（フェイルクローズ）。
 * - 比較はタイミング攻撃対策として timingSafeEqual を使う。
 */
export function verifyUsageSyncToken(
  authorizationHeader: string | null,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) return false;
  if (!authorizationHeader) return false;

  const match = /^Bearer\s+(\S+)$/.exec(authorizationHeader);
  if (!match) return false;

  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
