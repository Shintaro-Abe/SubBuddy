import { LogoutButton } from "@/components/LogoutButton";
import { NoticeList } from "@/components/NoticeList";
import { NotificationSettingsPanel } from "@/components/NotificationSettingsPanel";
import { parseAuthConfig } from "@/config/auth";
import { parseNotificationConfig } from "@/config/notifications";
import { requireServerUserId } from "@/lib/server-auth";
import { getNotificationPreferences, listNotificationNotices } from "@/services/notifications";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireServerUserId();
  const config = parseAuthConfig();
  const notificationConfig = parseNotificationConfig();
  const notificationData = notificationConfig.enabled
    ? await Promise.all([getNotificationPreferences(userId), listNotificationNotices(userId)])
    : null;

  return (
    <div>
      <p className="display">設定</p>
      <p className="caption mt-2">アカウントに関する操作を確認できます。</p>

      {notificationData ? (
        <>
          <NotificationSettingsPanel initialPreferences={notificationData[0]} />
          <NoticeList initialItems={notificationData[1]} />
        </>
      ) : (
        <section className="section panel" aria-labelledby="notification-settings-heading">
          <h2 className="title" id="notification-settings-heading">
            通知
          </h2>
          <p className="body mt-2">
            通知は現在準備中です。設定、許可要求、予約、配信はまだ有効になっていません。
          </p>
        </section>
      )}

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
