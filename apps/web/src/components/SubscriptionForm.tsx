"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * サブスク登録/編集フォーム（T6-3）。
 * 送信先は Zod 検証済みの API（新規=POST、編集=PUT）。
 * 入力値は React がエスケープして描画するため XSS は発生しない（dangerouslySetInnerHTML は不使用）。
 */
export interface SubscriptionFormValues {
  name: string;
  category: string;
  amount: number;
  billingCycle: "monthly" | "yearly";
  nextRenewalDate?: string;
  importance: number;
  cancellationUrl?: string;
  notes?: string;
  status: "active" | "paused" | "canceled";
}

const EMPTY: SubscriptionFormValues = {
  name: "",
  category: "",
  amount: 0,
  billingCycle: "monthly",
  nextRenewalDate: "",
  importance: 3,
  cancellationUrl: "",
  notes: "",
  status: "active",
};

export function SubscriptionForm({
  id,
  initial,
}: {
  id?: string;
  initial?: Partial<SubscriptionFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SubscriptionFormValues>({ ...EMPTY, ...initial });
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setIssues([]);
    setError(null);

    // 空文字の任意項目は送らない（Zod の optional に合わせる）。
    const payload: Record<string, unknown> = {
      name: values.name,
      category: values.category,
      amount: Number(values.amount),
      billingCycle: values.billingCycle,
      importance: Number(values.importance),
      status: values.status,
    };
    if (values.nextRenewalDate) payload.nextRenewalDate = values.nextRenewalDate;
    if (values.cancellationUrl) payload.cancellationUrl = values.cancellationUrl;
    if (values.notes) payload.notes = values.notes;

    try {
      const res = await fetch(id ? `/api/subscriptions/${id}` : "/api/subscriptions", {
        method: id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        router.push(`/subscriptions/${id ?? saved.id}`);
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (body.issues) setIssues(body.issues);
      else setError("保存に失敗しました。入力内容を確認してください。");
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const field = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium text-zinc-700";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {issues.length > 0 && (
        <ul className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {issues.map((i, idx) => (
            <li key={idx}>
              {i.path}: {i.message}
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className={label}>サービス名</label>
        <input
          className={field}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          required
          maxLength={200}
        />
      </div>

      <div>
        <label className={label}>カテゴリ</label>
        <input
          className={field}
          value={values.category}
          onChange={(e) => set("category", e.target.value)}
          required
          maxLength={100}
          placeholder="music / video / news など"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>金額（円・整数）</label>
          <input
            type="number"
            min={0}
            step={1}
            className={field}
            value={values.amount}
            onChange={(e) => set("amount", Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className={label}>課金周期</label>
          <select
            className={field}
            value={values.billingCycle}
            onChange={(e) => set("billingCycle", e.target.value as "monthly" | "yearly")}
          >
            <option value="monthly">月額</option>
            <option value="yearly">年額</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>次回更新日</label>
          <input
            type="date"
            className={field}
            value={values.nextRenewalDate ?? ""}
            onChange={(e) => set("nextRenewalDate", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>重要度（1〜5）</label>
          <input
            type="number"
            min={1}
            max={5}
            step={1}
            className={field}
            value={values.importance}
            onChange={(e) => set("importance", Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className={label}>解約手続き URL（任意）</label>
        <input
          type="url"
          className={field}
          value={values.cancellationUrl ?? ""}
          onChange={(e) => set("cancellationUrl", e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div>
        <label className={label}>メモ（任意）</label>
        <textarea
          className={field}
          rows={2}
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={2000}
        />
      </div>

      {id && (
        <div>
          <label className={label}>状態</label>
          <select
            className={field}
            value={values.status}
            onChange={(e) =>
              set("status", e.target.value as "active" | "paused" | "canceled")
            }
          >
            <option value="active">継続中</option>
            <option value="paused">一時停止</option>
            <option value="canceled">解約済み</option>
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
