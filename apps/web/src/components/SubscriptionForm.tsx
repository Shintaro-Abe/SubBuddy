"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/client-api";
import { ServiceCatalogSearch } from "./ServiceCatalogSearch";

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
  matchedServiceId?: string;
  usageType: string;
  initialValueAnswer?: string;
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
  matchedServiceId: undefined,
  usageType: "active_foreground",
  initialValueAnswer: undefined,
};

const USAGE_TYPE_OPTIONS = [
  { value: "active_foreground", label: "iPhoneアプリで使う" },
  { value: "active_background", label: "音楽・ポッドキャストなど裏で再生する" },
  { value: "active_other_device", label: "PC・テレビ・Webで使う（iPhoneでは使わない）" },
  { value: "passive", label: "保管・同期・常時稼働するサービス" },
  { value: "entitlement", label: "会員特典・送料無料など権利として持っている" },
] as const;

const VALUE_ANSWER_OPTIONS = [
  { value: "very_important", label: "すぐ困る" },
  { value: "somewhat", label: "少し困る" },
  { value: "not_much", label: "あまり困らない" },
] as const;

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
  const [catalogMatched, setCatalogMatched] = useState(!!initial?.matchedServiceId);

  function set<K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setIssues([]);
    setError(null);

    const payload: Record<string, unknown> = {
      name: values.name,
      category: values.category,
      amount: Number(values.amount),
      billingCycle: values.billingCycle,
      importance: Number(values.importance),
      status: values.status,
      usageType: values.usageType,
    };
    if (values.nextRenewalDate) payload.nextRenewalDate = values.nextRenewalDate;
    if (values.cancellationUrl) payload.cancellationUrl = values.cancellationUrl;
    if (values.notes) payload.notes = values.notes;
    if (values.matchedServiceId) payload.matchedServiceId = values.matchedServiceId;
    if (values.initialValueAnswer) payload.initialValueAnswer = values.initialValueAnswer;

    try {
      const res = await authenticatedFetch(id ? `/api/subscriptions/${id}` : "/api/subscriptions", {
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

  function issueMessage(path: keyof SubscriptionFormValues): string | null {
    return issues.find((issue) => issue.path === path)?.message ?? null;
  }

  return (
    <form onSubmit={handleSubmit} className="panel subscription-form" style={{ marginTop: 24 }}>
      {error && (
        <div className="field">
          <p className="help" role="alert" style={{ marginTop: 0 }}>
            {error}
          </p>
        </div>
      )}
      {issues.length > 0 && (
        <div className="field">
          <ul role="alert" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {issues.map((i, idx) => (
              <li key={idx} className="help" style={{ marginTop: idx === 0 ? 0 : 4 }}>
                {i.path}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* サービス名：カタログ検索 or 自由入力 */}
      <div className="field">
        <label className="label">サービス名</label>
        {!id ? (
          <ServiceCatalogSearch
            initialValue={values.name}
            onSelect={(entry) => {
              set("name", entry.canonicalName);
              set("category", entry.category);
              set("usageType", entry.usageType);
              set("matchedServiceId", entry.id);
              setCatalogMatched(true);
            }}
            onManualEntry={(name) => {
              set("name", name);
              setCatalogMatched(false);
              set("matchedServiceId", undefined);
            }}
          />
        ) : (
          <input
            id="name"
            className="input"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
            maxLength={200}
          />
        )}
        {issueMessage("name") && (
          <p className="help field-error" role="alert">
            {issueMessage("name")}
          </p>
        )}
        <div className="help">カタログから選ぶと、カテゴリや利用の性質が自動で入ります。</div>
      </div>

      {/* カテゴリ：カタログ選択時は自動設定・表示のみ */}
      <div className="field">
        <label htmlFor="category" className="label">
          カテゴリ
        </label>
        <input
          id="category"
          className="input"
          value={values.category}
          onChange={(e) => set("category", e.target.value)}
          required
          maxLength={100}
          readOnly={catalogMatched}
          placeholder="video_streaming / music / ai_tool など"
        />
        {issueMessage("category") && (
          <p className="help field-error" role="alert">
            {issueMessage("category")}
          </p>
        )}
        {catalogMatched && <p className="help">カタログから自動設定されました</p>}
      </div>

      {/* 利用の性質：カタログ選択時は自動設定、カタログ外はユーザーが選択 */}
      {!catalogMatched && (
        <div className="field">
          <label htmlFor="usageType" className="label">
            利用の仕方
          </label>
          <select
            id="usageType"
            className="input"
            value={values.usageType}
            onChange={(e) => set("usageType", e.target.value)}
          >
            {USAGE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {issueMessage("usageType") && (
            <p className="help field-error" role="alert">
              {issueMessage("usageType")}
            </p>
          )}
        </div>
      )}

      <div className="grid2">
        <div className="field">
          <label htmlFor="amount" className="label">
            金額（円・整数）
          </label>
          <input
            id="amount"
            type="number"
            min={0}
            step={1}
            className="input"
            value={values.amount}
            onChange={(e) => set("amount", Number(e.target.value))}
            required
          />
          {issueMessage("amount") && (
            <p className="help field-error" role="alert">
              {issueMessage("amount")}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="billingCycle" className="label">
            課金周期
          </label>
          <select
            id="billingCycle"
            className="input"
            value={values.billingCycle}
            onChange={(e) => set("billingCycle", e.target.value as "monthly" | "yearly")}
          >
            <option value="monthly">月額</option>
            <option value="yearly">年額</option>
          </select>
          {issueMessage("billingCycle") && (
            <p className="help field-error" role="alert">
              {issueMessage("billingCycle")}
            </p>
          )}
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="nextRenewalDate" className="label">
            次回更新日
          </label>
          <input
            id="nextRenewalDate"
            type="date"
            className="input"
            value={values.nextRenewalDate ?? ""}
            onChange={(e) => set("nextRenewalDate", e.target.value)}
          />
          {issueMessage("nextRenewalDate") && (
            <p className="help field-error" role="alert">
              {issueMessage("nextRenewalDate")}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="importance" className="label">
            重要度
          </label>
          <div className="seg" role="group" aria-label="重要度">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`opt${values.importance === n ? " sel" : ""}`}
                aria-pressed={values.importance === n}
                onClick={() => set("importance", n)}
              >
                {n}
              </button>
            ))}
          </div>
          {issueMessage("importance") && (
            <p className="help field-error" role="alert">
              {issueMessage("importance")}
            </p>
          )}
          <div className="help">「なくなったら困る度合い」。見直し材料の参考にします。</div>
        </div>
      </div>

      {/* 初回1問：新規登録時のみ表示 */}
      {!id && (
        <div className="field">
          <label className="label">このサブスクがなくなったら困りますか？</label>
          <div className="seg" role="group" aria-label="このサブスクがなくなったら困りますか？">
            {VALUE_ANSWER_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={`opt${values.initialValueAnswer === opt.value ? " sel" : ""}`}
                aria-pressed={values.initialValueAnswer === opt.value}
                onClick={() => set("initialValueAnswer", opt.value)}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              className="opt"
              onClick={() => set("initialValueAnswer", undefined)}
              style={{ color: "var(--faint)" }}
            >
              スキップ
            </button>
          </div>
          {issueMessage("initialValueAnswer") && (
            <p className="help field-error" role="alert">
              {issueMessage("initialValueAnswer")}
            </p>
          )}
        </div>
      )}

      <div className="field">
        <label htmlFor="cancellationUrl" className="label">
          解約手続き URL（任意）
        </label>
        <input
          id="cancellationUrl"
          type="url"
          className="input"
          value={values.cancellationUrl ?? ""}
          onChange={(e) => set("cancellationUrl", e.target.value)}
          placeholder="https://…"
        />
        {issueMessage("cancellationUrl") && (
          <p className="help field-error" role="alert">
            {issueMessage("cancellationUrl")}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="notes" className="label">
          メモ（任意）
        </label>
        <textarea
          id="notes"
          className="input"
          rows={2}
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={2000}
        />
        {issueMessage("notes") && (
          <p className="help field-error" role="alert">
            {issueMessage("notes")}
          </p>
        )}
      </div>

      {id && (
        <div className="field">
          <label htmlFor="status" className="label">
            状態
          </label>
          <select
            id="status"
            className="input"
            value={values.status}
            onChange={(e) => set("status", e.target.value as "active" | "paused" | "canceled")}
          >
            <option value="active">継続中</option>
            <option value="paused">一時停止</option>
            <option value="canceled">解約済み</option>
          </select>
          {issueMessage("status") && (
            <p className="help field-error" role="alert">
              {issueMessage("status")}
            </p>
          )}
        </div>
      )}

      <div className="form-actions" style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button type="submit" disabled={saving} className="btn">
          {saving ? "保存中…" : "保存"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn ghost">
          キャンセル
        </button>
      </div>
    </form>
  );
}
