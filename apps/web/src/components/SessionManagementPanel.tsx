"use client";

import { useEffect, useState } from "react";
import { MAX_ACTIVE_WEB_SESSIONS } from "@/config/session-limits";
import { authenticatedFetch } from "@/lib/client-api";

type SessionItem = {
  id: string;
  clientType: "web" | "ios";
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
};

type SessionsResponse = {
  items: SessionItem[];
};

function sessionLabel(item: SessionItem): string {
  if (item.clientType === "web") return "Webブラウザ";
  return item.deviceName ? `iPhoneアプリ（${item.deviceName}）` : "iPhoneアプリ";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SessionManagementPanel() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authenticatedFetch("/api/sessions")
      .then(async (response) => {
        if (!response.ok) throw new Error("session list failed");
        return (await response.json()) as SessionsResponse;
      })
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("接続中の端末を読み込めませんでした。時間をおいて、もう一度お試しください。");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function revokeSession(id: string) {
    if (revokingId) return;
    setRevokingId(id);
    setMessage(null);
    try {
      const response = await authenticatedFetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("session revoke failed");
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("選択した接続をログアウトしました。");
    } catch {
      setMessage("接続をログアウトできませんでした。時間をおいて、もう一度お試しください。");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="section panel" aria-labelledby="session-management-heading">
      <h2 className="title" id="session-management-heading">
        端末とセッション
      </h2>
      <p className="body mt-2">
        Webブラウザは同時に{MAX_ACTIVE_WEB_SESSIONS}
        件まで利用できます。登録iPhoneはこの件数に含まれません。心当たりのない接続や、使わなくなった接続はログアウトしてください。
      </p>
      <p className="caption mt-2">
        iPhoneアプリの接続をログアウトすると、そのiPhoneは再度ログインするまで同期できません。
      </p>

      {loading ? (
        <p className="caption mt-4" role="status">
          接続中の端末を読み込んでいます…
        </p>
      ) : items.length === 0 ? (
        <p className="body mt-4">有効な接続はありません。</p>
      ) : (
        <ul className="mt-4 mb-0 list-none p-0">
          {items.map((item) => (
            <li key={item.id} className="border-t border-hair py-4">
              <p className="label">
                {sessionLabel(item)}
                {item.current ? "（現在の接続）" : ""}
              </p>
              <p className="caption mt-2">最終利用：{formatDate(item.lastUsedAt)}</p>
              <p className="caption mt-2">接続開始：{formatDate(item.createdAt)}</p>
              {!item.current ? (
                <button
                  className="btn ghost mt-2"
                  type="button"
                  disabled={revokingId !== null}
                  onClick={() => void revokeSession(item.id)}
                >
                  {revokingId === item.id ? "ログアウトしています…" : "この接続をログアウト"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {message ? (
        <p className="caption mt-2" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
