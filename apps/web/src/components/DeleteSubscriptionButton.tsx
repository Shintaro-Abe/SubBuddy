"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/client-api";

/** サブスク削除ボタン。確認のうえ DELETE API を叩き、一覧へ戻る。 */
export function DeleteSubscriptionButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("このサブスクを削除しますか？（利用履歴・見直し情報も削除されます）")) return;
    setBusy(true);
    try {
      const res = await authenticatedFetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/subscriptions");
        router.refresh();
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="btn ghost disabled:opacity-50"
      style={{ color: "var(--red)", borderColor: "#e0c4bf" }}
    >
      {busy ? "削除中…" : "削除"}
    </button>
  );
}
