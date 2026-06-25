import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/user";
import { getSubscription } from "@/repositories/subscriptions";
import { listLatestRecommendations } from "@/repositories/recommendations";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";
import { categoryLabel, daysSince, formatDate, formatYen, safeHttpUrl } from "@/lib/display";
import { DecisionBadge } from "@/components/DecisionBadge";
import { DeleteSubscriptionButton } from "@/components/DeleteSubscriptionButton";
import { ShortcutsQrCode } from "@/components/ShortcutsQrCode";
import { CapacityInput } from "@/components/CapacityInput";
import { parseMatchedPatterns } from "@/domain/scoring/matchedPatterns";

export const dynamic = "force-dynamic";

function Row({
  label,
  value,
  amount = false,
}: {
  label: string;
  value: React.ReactNode;
  amount?: boolean;
}) {
  return (
    <div className="rowitem">
      <span className="caption" style={{ margin: 0 }}>
        {label}
      </span>
      <span className={amount ? "num" : "body"} style={{ textAlign: "right" }}>
        {value}
      </span>
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
  const sRec = s as Record<string, unknown>;
  const usageType = sRec.usageType as string | undefined;
  const showQr = usageType === "active_foreground" || usageType === "active_background";
  const isCapacity = usageType === "capacity";
  const capacityCheckedAt = sRec.capacityCheckedAt as Date | null | undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="caption" style={{ margin: 0 }}>
          サブスク一覧 ／ {s.name}
        </p>
        <div className="flex gap-2">
          <Link href={`/subscriptions/${s.id}/edit`} className="btn ghost">
            編集
          </Link>
          <DeleteSubscriptionButton id={s.id} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="display" style={{ margin: 0 }}>
          {s.name}
        </p>
        <DecisionBadge recommendation={rec} />
      </div>
      <p className="caption" style={{ marginTop: 4 }}>
        {categoryLabel(s.category)}
      </p>

      <div className="grid2" style={{ marginTop: 24, alignItems: "start" }}>
        <section className="panel">
          <p className="title" style={{ marginBottom: 8 }}>
            契約情報
          </p>
          <Row
            label="金額"
            value={`${formatYen(s.amount)} / ${s.billingCycle === "yearly" ? "年" : "月"}`}
            amount
          />
          <Row label="月額換算" value={formatYen(toMonthlyAmount(s.amount, s.billingCycle))} amount />
          <Row
            label={isCapacity ? "年額換算（月額×12の目安）" : "年額換算"}
            value={formatYen(toYearlyAmount(s.amount, s.billingCycle))}
            amount
          />
          <Row label="次回更新日" value={formatDate(s.nextRenewalDate)} />
          <Row label="重要度" value={`${s.importance} / 5`} />
          <Row
            label="状態"
            value={s.status === "active" ? "継続中" : s.status === "paused" ? "一時停止" : "解約済み"}
          />
          {s.notes && <Row label="メモ" value={s.notes} />}
        </section>

        <section className="panel">
          <p className="title" style={{ marginBottom: 8 }}>
            レコメンド
          </p>
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
                      amount
                    />
                  )}
                  <Row label="重複あり" value={rec.hasOverlap ? "あり" : "なし"} />

                  {/* 節約額（中立トーン：事実として控えめに表示） */}
                  {rec.decision && rec.decision !== "keep" && (
                    <Row
                      label="解約した場合の年間節約額"
                      value={
                        <span className="num" style={{ color: "var(--muted)" }}>
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
                  <div className="chips" style={{ marginTop: 14 }}>
                    {patterns.map((p) => (
                      <span key={p.pattern} title={p.evidence} className="chip">
                        {p.label}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* 理由（パターン根拠）：落ち着いた表示 */}
              <p className="body" style={{ marginTop: 14 }}>
                {rec.reason}
              </p>
            </>
          ) : (
            <p className="caption" style={{ margin: 0 }}>
              まだ判定がありません。ダッシュボードの「判定を再計算」を実行してください。
            </p>
          )}
        </section>
      </div>

      {isCapacity && (
        <CapacityInput
          subscriptionId={s.id}
          initialPlanGb={(sRec.planCapacityGb as number | null) ?? null}
          initialUsedGb={(sRec.usedCapacityGb as number | null) ?? null}
          checkedAt={capacityCheckedAt ? capacityCheckedAt.toISOString().slice(0, 10) : null}
          daysSinceCheck={daysSince(capacityCheckedAt)}
        />
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {cancelUrl && (
          <a href={cancelUrl} target="_blank" rel="noopener noreferrer" className="btn ghost">
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

      <div className="foot">
        <span>SubBuddy</span>
        <span>プライバシー方針 ・ 利用規約</span>
      </div>
    </div>
  );
}
