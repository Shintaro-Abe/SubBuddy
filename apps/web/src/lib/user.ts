/**
 * MVP は localhost 単一ユーザー（認証なし・design §4 / requirements Q3）。
 * 全テーブルに user_id を持たせてマルチテナント余地は残しつつ、当面は固定ユーザーで運用する。
 * ポストMVP でローカル簡易認証を入れる際は、ここを差し替える。
 */
export const LOCAL_USER_ID = "user_local";

export function getCurrentUserId(): string {
  return LOCAL_USER_ID;
}
