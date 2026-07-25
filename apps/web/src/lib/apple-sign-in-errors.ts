import { MAX_ACTIVE_WEB_SESSIONS } from "@/config/session-limits";

export function appleSignInErrorMessage(status: number): string {
  if (status === 409) {
    return `Webブラウザのログインが${MAX_ACTIVE_WEB_SESSIONS}件に達しています。ログイン済みの端末で「設定」→「端末とセッション」を開き、不要な接続を解除してください。`;
  }
  return "Appleでサインインできませんでした。時間をおいて再度お試しください。";
}
