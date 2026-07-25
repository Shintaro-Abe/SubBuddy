"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/lib/client-api";

type Preferences = {
  yearlyRenewalEnabled: boolean;
  monthlyRenewalEnabled: boolean;
  syncFailureEnabled: boolean;
  newSignInPushEnabled: boolean;
};

export function NotificationSettingsPanel({
  initialPreferences,
}: {
  initialPreferences: Preferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function updatePreference(key: keyof Preferences, value: boolean) {
    const previous = preferences;
    setPreferences({ ...preferences, [key]: value });
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error();
      const saved = (await response.json()) as Preferences;
      setPreferences(saved);
      setMessage("通知の希望を保存しました。iPhoneの端末設定は次回同期時に反映されます。");
    } catch {
      setPreferences(previous);
      setMessage("保存できませんでした。時間をおいて、もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  const options: Array<{ key: keyof Preferences; label: string; help: string }> = [
    {
      key: "yearlyRenewalEnabled",
      label: "年額契約の更新前",
      help: "更新予定日の7日前、午前10時にiPhoneで知らせます。",
    },
    {
      key: "monthlyRenewalEnabled",
      label: "月額契約の更新前",
      help: "有効にした場合だけ、更新予定日の1日前、午前10時にiPhoneで知らせます。",
    },
    {
      key: "syncFailureEnabled",
      label: "同期できない状態が続いたとき",
      help: "未送信記録が24時間残ったiPhoneだけで知らせます。",
    },
    {
      key: "newSignInPushEnabled",
      label: "新しい端末・ブラウザでのサインイン",
      help: "プッシュを停止しても、アプリ内のお知らせには残ります。",
    },
  ];

  return (
    <section className="section panel" aria-labelledby="notification-preferences-heading">
      <h2 className="title" id="notification-preferences-heading">
        通知
      </h2>
      <p className="body mt-2">
        ここでは通知の希望を管理します。iPhoneで実際に受け取るには、そのiPhoneでも通知を許可してください。
      </p>
      <div className="mt-4">
        {options.map((option) => (
          <label key={option.key} className="field" style={{ display: "block" }}>
            <span className="label">
              <input
                type="checkbox"
                checked={preferences[option.key]}
                disabled={busy}
                onChange={(event) => void updatePreference(option.key, event.target.checked)}
                style={{ marginRight: 8 }}
              />
              {option.label}
            </span>
            <span className="help" style={{ display: "block" }}>
              {option.help}
            </span>
          </label>
        ))}
      </div>
      {message ? (
        <p className="caption mt-2" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
