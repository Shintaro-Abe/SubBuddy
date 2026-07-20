import { LogoutButton } from "@/components/LogoutButton";
import { parseAuthConfig } from "@/config/auth";
import { requireServerUserId } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireServerUserId();
  const config = parseAuthConfig();

  return (
    <div>
      <p className="display">設定</p>
      <p className="caption mt-2">アカウントに関する操作を確認できます。</p>

      <section className="section panel" aria-labelledby="account-settings-heading">
        <h1 className="title" id="account-settings-heading">
          アカウント
        </h1>
        {config.mode === "local" ? (
          <p className="body mt-2">
            この環境はログインを使わず、この端末内だけで利用します。そのためログアウト操作はありません。
          </p>
        ) : (
          <>
            <p className="body mt-2">このブラウザで使用中のアカウントからログアウトします。</p>
            <LogoutButton />
          </>
        )}
      </section>
    </div>
  );
}
