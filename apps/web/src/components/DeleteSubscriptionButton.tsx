"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** サブスク削除ボタン。確認のうえ DELETE API を叩き、一覧へ戻る。 */
export function DeleteSubscriptionButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("このサブスクを削除しますか？（利用履歴・判定も削除されます）")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
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
      className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? "削除中…" : "削除"}
    </button>
  );
}
