/**
 * local mode の固定ユーザー。
 * 全テーブルに user_id を持たせ、Route Handler 以降は認証境界で解決済みの userId を使う。
 * cloud-testflight / production では Apple サインインや device token auth から userId を解決する。
 */
export const LOCAL_USER_ID = "user_local";

export function getCurrentUserId(): string {
  return LOCAL_USER_ID;
}
