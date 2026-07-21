"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/client-api";
import { defaultScoringConfig } from "@/config/scoring";

/**
 * iCloud+ の「使用容量」を just-in-time で入力するフォーム（容量ゲート用）。
 * 保存（PUT）→ 判定の再計算（POST）→ 画面更新 の順で反映する。
 *
 * 契約プラン容量はここで入力させない。プランは登録（名前・金額）が唯一の出所で、
 * 表示用の値は登録情報（金額→カタログ）から導出して prop で受け取る。
 * この画面が聞くのは「使用容量」だけ。
 */

// 鮮度判定のしきい値はコードに直書きせず config に集約（CLAUDE.md：しきい値の設定外出し）。
const FRESHNESS_DAYS = defaultScoringConfig.capacityFreshnessDays;

// Apple 公式：iCloud ストレージの確認・管理（日本語）。検証済み 2026-06-25。
const APPLE_STORAGE_HELP_URL = "https://support.apple.com/ja-jp/108922";

// 容量(GB)を表示用ラベルに（1,000GB以上は TB 表記）。
function formatGb(gb: number): string {
  return gb >= 1000 ? `${gb / 1000}TB` : `${gb}GB`;
}

export function CapacityInput({
  subscriptionId,
  planCapacityGb,
  initialUsedGb,
  checkedAt,
  daysSinceCheck,
}: {
  subscriptionId: string;
  // 現在の契約プラン容量(GB)。登録情報（金額→カタログ）から導出した表示専用の値。
  planCapacityGb: number | null;
  initialUsedGb: number | null;
  checkedAt: string | null;
  // 確認日からの経過日数。現在時刻依存の計算はサーバ（描画外）で行い prop で受け取る。
  daysSinceCheck: number | null;
}) {
  const router = useRouter();
  const [usedGb, setUsedGb] = useState<number | "">(initialUsedGb ?? "");
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || saving;

  const isStale = daysSinceCheck !== null && daysSinceCheck > FRESHNESS_DAYS;

  // 使用率（入力中の値で即時に反映する）。プラン容量が分からなければ出さない。
  const usagePercent =
    planCapacityGb !== null && planCapacityGb > 0 && usedGb !== ""
      ? Math.min(100, Math.round((Number(usedGb) / planCapacityGb) * 100))
      : null;

  async function handleSave() {
    if (usedGb === "") {
      setError("使用容量を入力してください");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await authenticatedFetch(`/api/subscriptions/${subscriptionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usedCapacityGb: Number(usedGb),
          capacityCheckedAt: today,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      // 使用容量が変わると判定（安全に下げられるか）も変わるので再計算する。
      await authenticatedFetch("/api/recommendations/recompute", { method: "POST" });
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
        <a
          href={APPLE_STORAGE_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          設定 ＞ iCloud のストレージ画面 ↗
        </a>
        で「使用済み」の数値を入れると、下位プランで足りるかを判定します。
      </p>

      <div className="rowitem detail-row">
        <span className="caption" style={{ margin: 0 }}>
          現在のプラン
        </span>
        <span className="caption" style={{ margin: 0 }}>
          {planCapacityGb !== null ? `${formatGb(planCapacityGb)}（登録情報より）` : "—"}
        </span>
      </div>

      <div className="rowitem detail-row">
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

      {usagePercent !== null && planCapacityGb !== null && (
        <div style={{ marginTop: 12 }}>
          <p className="caption" style={{ margin: 0 }}>
            使用率 {usagePercent}%（{Number(usedGb).toLocaleString()} /{" "}
            {planCapacityGb.toLocaleString()} GB）
          </p>
          <div
            aria-hidden
            style={{
              height: 6,
              background: "var(--track)",
              borderRadius: 999,
              marginTop: 6,
              overflow: "hidden",
            }}
          >
            <div style={{ width: `${usagePercent}%`, height: "100%", background: "var(--sage)" }} />
          </div>
        </div>
      )}

      {error && (
        <p className="caption" style={{ color: "var(--danger, #c0392b)", marginTop: 8 }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={handleSave} disabled={busy} className="btn">
          {busy ? "保存中…" : "保存して判定する"}
        </button>
        {checkedAt && (
          <span className="caption" style={{ margin: 0 }}>
            最終確認：{checkedAt}
            {daysSinceCheck !== null && `（${daysSinceCheck}日前）`}
          </span>
        )}
        {isStale && (
          <span
            className="chip"
            style={{ color: "var(--amber)", background: "#efe6d2" }}
            title={`前回確認から${daysSinceCheck}日。容量は変わります。最新の数値で再確認をおすすめします。`}
          >
            再確認をおすすめ
          </span>
        )}
      </div>
    </section>
  );
}
