"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/client-api";

/**
 * 全件再計算ボタン。/api/recommendations/recompute を叩いて結果を反映する。
 */
export function RecomputeButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const busy = pending || loading;

  async function handleClick() {
    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/recommendations/recompute", { method: "POST" });
      if (!res.ok) throw new Error("recompute failed");
      startTransition(() => router.refresh());
    } catch {
      // 失敗時は黙って終了（UI は変化なし）。詳細はサーバーログ側。
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="btn ghost disabled:opacity-50"
    >
      {busy ? "再計算中…" : "判定を再計算"}
    </button>
  );
}
