import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/user";
import { getSubscription } from "@/repositories/subscriptions";
import { listLatestRecommendations } from "@/repositories/recommendations";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";
import { formatDate, formatYen, safeHttpUrl } from "@/lib/display";
import { DecisionBadge } from "@/components/DecisionBadge";
import { DeleteSubscriptionButton } from "@/components/DeleteSubscriptionButton";
import { ShortcutsQrCode } from "@/components/ShortcutsQrCode";
import { parseMatchedPatterns } from "@/domain/scoring/matchedPatterns";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = getCurrentUserId();
  const s = await getSubscription(userId, id);
  if (!s) notFound();

  const recs = await listLatestRecommendations(userId);
  const rec = recs.find((r) => r.subscriptionId === id) ?? null;
  const cancelUrl = safeHttpUrl(s.cancellationUrl);
  const usageType = (s as Record<string, unknown>).usageType as string | undefined;
  const showQr = usageType === "active_foreground" || usageType === "active_background";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{s.name}</h1>
            <DecisionBadge recommendation={rec} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">{s.category}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/subscriptions/${s.id}/edit`}
            className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            編集
          </Link>
          <DeleteSubscriptionButton id={s.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">契約情報</h2>
          <Row label="金額" value={`${formatYen(s.amount)} / ${s.billingCycle === "yearly" ? "年" : "月"}`} />
          <Row label="月額換算" value={formatYen(toMonthlyAmount(s.amount, s.billingCycle))} />
          <Row label="年額換算" value={formatYen(toYearlyAmount(s.amount, s.billingCycle))} />
          <Row label="次回更新日" value={formatDate(s.nextRenewalDate)} />
          <Row label="重要度" value={`${s.importance} / 5`} />
          <Row
            label="状態"
            value={s.status === "active" ? "継続中" : s.status === "paused" ? "一時停止" : "解約済み"}
          />
          {s.notes && <Row label="メモ" value={s.notes} />}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">レコメンド</h2>
          {rec ? (
            <>
              {rec.dataStatus === "observing" ? (
                <Row label="状態" value={`観測中（あと ${rec.daysUntilReady} 日）`} />
              ) : (
                <>
                  {rec.daysSinceLastUse !== null && (
                    <Row
                      label="最終利用からの日数"
                      value={`${rec.daysSinceLastUse} 日`}
                    />
                  )}
                  <Row label="重複あり" value={rec.hasOverlap ? "あり" : "なし"} />

                  {/* 節約額 */}
                  {rec.decision && rec.decision !== "keep" && (
                    <Row
                      label="解約した場合の年間節約額"
                      value={
                        <span className="text-red-600">
                          {formatYen(rec.yearlyAmount)}
                        </span>
                      }
                    />
                  )}
                </>
              )}

              {/* 根拠タグ（matchedPatterns）。根拠がないときは出さない */}
              {(() => {
                const patterns = parseMatchedPatterns(rec.matchedPatterns);
                if (patterns.length === 0) return null;
                return (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {patterns.map((p) => (
                      <span
                        key={p.pattern}
                        title={p.evidence}
                        className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200"
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* 理由（パターン根拠） */}
              <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
                {rec.reason}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              まだ判定がありません。ダッシュボードの「判定を再計算」を実行してください。
            </p>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        {cancelUrl && (
          <a
            href={cancelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            解約手続きページを開く ↗
          </a>
        )}

        {showQr && (
          <ShortcutsQrCode
            subscriptionId={s.id}
            subscriptionName={s.name}
            usageSyncToken={process.env.USAGE_SYNC_TOKEN ?? null}
          />
        )}
      </div>
    </div>
  );
}
