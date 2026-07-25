"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/lib/client-api";

type Notice = {
  id: string;
  kind:
    | "renewal_reminder"
    | "sync_failure"
    | "new_sign_in"
    | "account_deletion_scheduled"
    | "safety_incident";
  eventAt: string | Date;
  readAt: string | Date | null;
  safeArguments: unknown;
};

function noticeText(notice: Notice): { title: string; body: string } {
  if (notice.kind === "new_sign_in") {
    const args =
      typeof notice.safeArguments === "object" && notice.safeArguments
        ? (notice.safeArguments as { clientType?: unknown })
        : {};
    const clientType = typeof args.clientType === "string" ? args.clientType : "新しい端末";
    return {
      title: "新しいサインイン",
      body: `${clientType}からサインインがありました。心当たりがない場合は「端末とセッション」を確認してください。`,
    };
  }
  if (notice.kind === "account_deletion_scheduled") {
    return {
      title: "アカウントに関する重要なお知らせ",
      body: "削除予定と対応方法を確認してください。",
    };
  }
  return {
    title: "安全性・サービス状況のお知らせ",
    body: "安全性または長期障害に関する内容を確認してください。",
  };
}

export function NoticeList({ initialItems }: { initialItems: Notice[] }) {
  const [items, setItems] = useState(initialItems);

  async function markRead(id: string) {
    const response = await authenticatedFetch(`/api/notices/${id}/read`, { method: "POST" });
    if (!response.ok) return;
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
  }

  return (
    <section className="section panel" aria-labelledby="notices-heading">
      <h2 className="title" id="notices-heading">
        お知らせ
      </h2>
      {items.length === 0 ? (
        <p className="body mt-2">現在、お知らせはありません。</p>
      ) : (
        <ul className="mt-4" style={{ listStyle: "none", marginBottom: 0, padding: 0 }}>
          {items.map((item) => {
            const text = noticeText(item);
            return (
              <li key={item.id} style={{ paddingBlock: 12 }}>
                <p className="label">
                  {!item.readAt ? "未読・" : ""}
                  {text.title}
                </p>
                <p className="body mt-2">{text.body}</p>
                <p className="caption mt-2">{new Date(item.eventAt).toLocaleString("ja-JP")}</p>
                {!item.readAt ? (
                  <button
                    className="btn ghost mt-2"
                    type="button"
                    onClick={() => void markRead(item.id)}
                  >
                    確認済みにする
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
