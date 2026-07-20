"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authenticatedFetch } from "@/lib/client-api";
import { GUIDANCE_STEPS, type GuidanceProgress } from "@/lib/guidance";

export function GettingStartedChecklist({
  progress,
  subscriptionCount,
  compact = false,
}: {
  progress: GuidanceProgress;
  subscriptionCount: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function finishInventory() {
    setSaving(true);
    try {
      const response = await authenticatedFetch("/api/guidance-progress", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "inventory_completed" }),
      });
      if (response.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (progress.isComplete && compact) {
    return (
      <details className="panel mt-5">
        <summary className="cursor-pointer font-bold">はじめ方を確認する</summary>
        <p className="caption mt-2">4項目を完了しました。使い方はいつでも確認できます。</p>
        <Link href="/getting-started" className="mt-2 inline-block text-[var(--sage)] underline">
          使い方を開く
        </Link>
      </details>
    );
  }

  return (
    <section className="panel mt-5" aria-labelledby="getting-started-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="getting-started-title" className="title">
          はじめ方
        </h2>
        <span className="caption num">
          {progress.completedCount} / {progress.totalCount}
        </span>
      </div>
      <p className="caption mt-1">実際の操作に合わせて自動で進みます。</p>

      <ol className="mt-4 space-y-3">
        {GUIDANCE_STEPS.map((step, index) => {
          const done = progress.steps[step.key];
          return (
            <li
              key={step.key}
              id={step.key === "measurement" ? "measurement" : undefined}
              className="flex items-start gap-3 border-t border-[var(--hair)] pt-3"
            >
              <span aria-hidden="true" className="num mt-0.5 w-6 shrink-0">
                {done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{step.title}</p>
                <p className="caption mt-1">{step.description}</p>
                {!done && step.key === "inventory" && subscriptionCount > 0 ? (
                  <button
                    type="button"
                    className="btn ghost mt-2"
                    disabled={saving}
                    onClick={finishInventory}
                  >
                    {saving ? "記録中" : "棚卸しを終える"}
                  </button>
                ) : !done || !compact ? (
                  <Link
                    href={
                      !done && step.key === "inventory" && subscriptionCount === 0
                        ? "/subscriptions/new"
                        : step.href
                    }
                    className="mt-2 inline-block text-sm font-bold text-[var(--sage)] underline"
                  >
                    {!done && step.key === "inventory" && subscriptionCount === 0
                      ? "最初の契約を登録"
                      : step.action}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
