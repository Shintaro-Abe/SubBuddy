"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * iCloud+ の容量を just-in-time で入力するフォーム（容量ゲート用）。
 * 保存（PUT）→ 判定の再計算（POST）→ 画面更新 の順で反映する。
 * オンボーディング必須にはせず、容量型サブスクの詳細でのみ表示する。
 */

// 無料枠5GBは選択肢に出さない（誤入力源を断つ）。
const PLAN_OPTIONS = [
  { gb: 50, label: "50GB" },
  { gb: 200, label: "200GB" },
  { gb: 2000, label: "2TB" },
  { gb: 6000, label: "6TB" },
  { gb: 12000, label: "12TB" },
];

export function CapacityInput({
  subscriptionId,
  initialPlanGb,
  initialUsedGb,
  checkedAt,
}: {
  subscriptionId: string;
  initialPlanGb: number | null;
  initialUsedGb: number | null;
  checkedAt: string | null;
}) {
  const router = useRouter();
  const [planGb, setPlanGb] = useState<number | "">(initialPlanGb ?? "");
  const [usedGb, setUsedGb] = useState<number | "">(initialUsedGb ?? "");
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || saving;

  async function handleSave() {
    if (planGb === "" || usedGb === "") {
      setError("プラン容量と使用容量を入力してください");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCapacityGb: Number(planGb),
          usedCapacityGb: Number(usedGb),
          capacityCheckedAt: today,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      // 容量が変わると判定（安全に下げられるか）も変わるので再計算する。
      await fetch("/api/recommendations/recompute", { method: "POST" });
      startTransition(() => router.refresh());
    } catch {
      setError("保存に失敗しました。時間をおいて試してください");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <p className="title" style={{ marginBottom: 8 }}>
        使用容量を確認
      </p>
      <p className="caption" style={{ marginTop: 0 }}>
        設定 ＞ iCloud のストレージ画面の数値を入れると、下位プランで足りるかを判定します。
      </p>

      <div className="rowitem">
        <label className="caption" style={{ margin: 0 }} htmlFor="planGb">
          契約プラン容量
        </label>
        <select
          id="planGb"
          className="input"
          style={{ maxWidth: 160 }}
          value={planGb}
          onChange={(e) => setPlanGb(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">選択</option>
          {PLAN_OPTIONS.map((p) => (
            <option key={p.gb} value={p.gb}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rowitem">
        <label className="caption" style={{ margin: 0 }} htmlFor="usedGb">
          使用容量（GB）
        </label>
        <input
          id="usedGb"
          className="input"
          style={{ maxWidth: 160, textAlign: "right" }}
          type="number"
          min={0}
          inputMode="numeric"
          value={usedGb}
          onChange={(e) => setUsedGb(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </div>

      {error && (
        <p className="caption" style={{ color: "var(--danger, #c0392b)", marginTop: 8 }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
        <button type="button" onClick={handleSave} disabled={busy} className="btn">
          {busy ? "保存中…" : "保存して判定する"}
        </button>
        {checkedAt && (
          <span className="caption" style={{ margin: 0 }}>
            最終確認：{checkedAt}
          </span>
        )}
      </div>
    </section>
  );
}
