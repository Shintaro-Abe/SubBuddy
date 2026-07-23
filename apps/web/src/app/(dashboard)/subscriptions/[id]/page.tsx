import Link from "next/link";
import { notFound } from "next/navigation";
import { requireServerUserId } from "@/lib/server-auth";
import { getSubscription } from "@/repositories/subscriptions";
import { getSubscriptionsWithLatestRecommendation } from "@/lib/queries";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";
import { categoryLabel, daysSince, formatDate, formatYen, safeHttpUrl } from "@/lib/display";
import { DecisionBadge } from "@/components/DecisionBadge";
import { DeleteSubscriptionButton } from "@/components/DeleteSubscriptionButton";
import { ShortcutsQrCode } from "@/components/ShortcutsQrCode";
import { CapacityInput } from "@/components/CapacityInput";
import { parseMatchedPatterns } from "@/domain/scoring/matchedPatterns";
import { parseReviewOptions, parseReviewUnknowns } from "@/domain/review/output";
import { GuidanceEventReporter } from "@/components/GuidanceEventReporter";

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
    <div className="rowitem detail-row">
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
  const userId = await requireServerUserId();
  const s = await getSubscription(userId, id);
  if (!s) notFound();

  const reviewRows = await getSubscriptionsWithLatestRecommendation(userId);
  const reviewRow = reviewRows.find((row) => row.subscription.id === id);
  const rec = reviewRow?.recommendation ?? null;
  const reviewBlocked = reviewRow?.reviewBlocked ?? false;
  const cancelUrl = safeHttpUrl(s.cancellationUrl);
  const sRec = s as Record<string, unknown>;
  const usageType = sRec.usageType as string | undefined;
  const showQr = usageType === "active_foreground" || usageType === "active_background";
  const isCapacity = usageType === "capacity";
  const capacityCheckedAt = sRec.capacityCheckedAt as Date | null | undefined;
  const currentPlanCapacityGb = isCapacity ? s.planCapacityGb : null;
  const reviewUnknowns = rec ? parseReviewUnknowns(rec.reviewUnknowns) ?? [] : [];
  const reviewOptions = rec ? parseReviewOptions(rec.reviewOptions) ?? [] : [];

  return (
    <div>
      {rec && <GuidanceEventReporter event="review_viewed" />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="caption" style={{ margin: 0 }}>
          契約 ／ {s.name}
        </p>
        <div className="flex gap-2">
          <Link href={`/subscriptions/${s.id}/edit`} className="btn ghost">
            編集
          </Link>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="display" style={{ margin: 0 }}>
          {s.name}
        </p>
        <DecisionBadge recommendation={rec} blocked={reviewBlocked} />
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
          <Row
            label="月額換算"
            value={formatYen(toMonthlyAmount(s.amount, s.billingCycle))}
            amount
          />
          <Row
            label={isCapacity ? "年額換算（月額×12の目安）" : "年額換算"}
            value={formatYen(toYearlyAmount(s.amount, s.billingCycle))}
            amount
          />
          <Row label="次回更新日" value={formatDate(s.nextRenewalDate)} />
          <Row label="重要度" value={`${s.importance} / 5`} />
          <Row
            label="状態"
            value={
              s.status === "active" ? "継続中" : s.status === "paused" ? "一時停止" : "解約済み"
            }
          />
          {s.notes && <Row label="メモ" value={s.notes} />}
        </section>

        <section className="panel">
          <p className="title" style={{ marginBottom: 8 }}>
            見直し
          </p>
          {reviewBlocked ? (
            <div>
              <p className="body">
                見直し情報を安全に表示できないため、古い内容を隠しています。
              </p>
              <p className="caption" style={{ marginTop: 8 }}>
                「見直し材料を再計算」を実行してください。
              </p>
            </div>
          ) : rec ? (
            <>
              <Row
                label="確認の優先度"
                value={<DecisionBadge recommendation={rec} />}
              />
              <Row label="最近30日の利用日" value={`${rec.usageDays30d} 日`} amount />
              {rec.usageMinutes30d > 0 && (
                <Row label="最近30日の利用時間目安" value={`${rec.usageMinutes30d} 分以上`} amount />
              )}
              {rec.costPerUsageDay !== null && (
                <Row
                  label="1利用日あたり"
                  value={formatYen(Math.round(rec.costPerUsageDay))}
                  amount
                />
              )}
              {rec.daysSinceLastUse !== null && (
                <Row label="最終利用からの日数" value={`${rec.daysSinceLastUse} 日`} amount />
              )}
              <Row label="重複する契約" value={rec.hasOverlap ? "あり" : "なし"} />
              <Row label="計算日" value={formatDate(rec.generatedAt)} />

              {(() => {
                const patterns = parseMatchedPatterns(rec.matchedPatterns);
                if (patterns.length === 0) return null;
                return (
                  <div style={{ marginTop: 16 }}>
                    <p className="title" style={{ fontSize: 16 }}>確認の根拠</p>
                    {patterns.map((p) => (
                      <div key={p.pattern} style={{ marginTop: 10 }}>
                        <p className="body" style={{ fontWeight: 700 }}>{p.label}</p>
                        <p className="caption" style={{ marginTop: 2 }}>{p.evidence}</p>
                        {p.caveat && (
                          <p className="caption" style={{ marginTop: 2, color: "var(--muted)" }}>
                            注意: {p.caveat}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <p className="body" style={{ marginTop: 14 }}>
                {rec.reason}
              </p>
            </>
          ) : (
            <p className="caption" style={{ margin: 0 }}>
              見直し情報はまだありません。「見直し材料を再計算」を実行してください。
            </p>
          )}
        </section>
      </div>

      {rec && !reviewBlocked && reviewUnknowns.length > 0 && (
        <section className="section panel">
          <h2 className="title">まだ分からないこと</h2>
          {reviewUnknowns.map((unknown) => (
            <p key={unknown.code} className="body" style={{ marginTop: 10 }}>
              {unknown.message}
            </p>
          ))}
        </section>
      )}

      {rec && !reviewBlocked && reviewOptions.length > 0 && (
        <section className="section panel">
          <h2 className="title">確認できる選択肢</h2>
          <div className="mobile-card-list" style={{ marginTop: 8 }}>
            {reviewOptions.map((option, index) => (
              <div key={`${option.kind}-${index}`} className="rowitem" style={{ display: "block" }}>
                <p className="body" style={{ fontWeight: 700 }}>{option.title}</p>
                <p className="caption" style={{ marginTop: 4 }}>{option.detail}</p>
                {option.annualSavings !== undefined && (
                  <p className="body num" style={{ marginTop: 6 }}>
                    年間差額の目安 {formatYen(option.annualSavings)}
                  </p>
                )}
                {option.calculation && (
                  <p className="caption" style={{ marginTop: 2 }}>
                    計算: {option.calculation}
                  </p>
                )}
                {option.verifiedAt && (
                  <p className="caption" style={{ marginTop: 2 }}>
                    料金確認日 {formatDate(option.verifiedAt)}
                  </p>
                )}
                {option.sourceUrl && (
                  <a
                    href={safeHttpUrl(option.sourceUrl) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="caption text-[var(--sage)] hover:underline"
                  >
                    確認に使った公式情報を見る ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isCapacity && (
        <CapacityInput
          subscriptionId={s.id}
          planCapacityGb={currentPlanCapacityGb}
          initialUsedGb={(sRec.usedCapacityGb as number | null) ?? null}
          checkedAt={capacityCheckedAt ? capacityCheckedAt.toISOString().slice(0, 10) : null}
          daysSinceCheck={daysSince(capacityCheckedAt)}
        />
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {cancelUrl && (
          <a href={cancelUrl} target="_blank" rel="noopener noreferrer" className="btn ghost">
            登録した手続きページを開く ↗
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

      <section className="section panel" aria-labelledby="other-actions-heading">
        <h2 className="title" id="other-actions-heading">
          その他の操作
        </h2>
        <p className="caption" style={{ marginTop: 6 }}>
          契約を削除すると、関連する利用履歴と見直し結果も削除されます。
        </p>
        <div style={{ marginTop: 12 }}>
          <DeleteSubscriptionButton id={s.id} />
        </div>
      </section>

      <div className="foot">
        <span>SubBuddy</span>
        <span>プライバシー方針 ・ 利用規約</span>
      </div>
    </div>
  );
}
