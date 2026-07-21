import { requireServerUserId } from "@/lib/server-auth";
import { listSubscriptions } from "@/repositories/subscriptions";
import { aggregateSpending } from "@/domain/spending/aggregate";
import { categoryLabel, formatYen } from "@/lib/display";
import { GuidanceEventReporter } from "@/components/GuidanceEventReporter";
import { ScreenIntro } from "@/components/ScreenIntro";

export const dynamic = "force-dynamic";

/**
 * 支出可視化（仮 UI・動作確認用）。
 * 仕上げのデザインは別途。ここでは集計結果が正しく出ることの確認を優先する。
 */
export default async function SpendingPage() {
  const subs = await listSubscriptions(await requireServerUserId());
  const summary = aggregateSpending(
    subs.map((s) => ({
      amount: s.amount,
      billingCycle: s.billingCycle,
      category: s.category,
      status: s.status,
      createdAt: s.createdAt,
    })),
    { referenceDate: new Date(), windowMonths: 6 },
  );

  const maxTrend = Math.max(1, ...summary.monthlyTrend.map((m) => m.monthly));
  const lastTrendIndex = summary.monthlyTrend.length - 1;

  return (
    <>
      <GuidanceEventReporter event="spending_viewed" />
      <p className="display">支出の内訳</p>
      <p className="caption" style={{ marginTop: 8 }}>
        継続中 <span className="num">{summary.activeCount}</span>{" "}
        件の支出を、合計・内訳・推移で見ています。
      </p>
      <ScreenIntro screen="spending">
        登録済みで継続中の契約を、月額と年額の目安へ換算しています。未登録の契約は含まれません。
      </ScreenIntro>

      {/* 合計 */}
      <div className="grid2 spending-summary" style={{ marginTop: 24 }}>
        <div className="panel">
          <div className="caption">月額合計（継続中）</div>
          <div className="num" style={{ fontSize: 30, marginTop: 4 }}>
            {formatYen(summary.monthlyTotal)}
          </div>
        </div>
        <div className="panel">
          <div className="caption">年額見込み（継続中）</div>
          <div className="num" style={{ fontSize: 30, marginTop: 4 }}>
            {formatYen(summary.yearlyTotal)}
          </div>
        </div>
      </div>

      {/* 月次推移 */}
      <section className="section">
        <div className="sechead">
          <h2 className="title">月ごとの推移</h2>
        </div>
        <div className="panel">
          {summary.monthlyTrend.length === 0 ? (
            <p className="caption" style={{ margin: 0 }}>
              継続中の契約がないため、推移はまだありません。
            </p>
          ) : (
            <>
              <div className="bars desktop-only">
                {summary.monthlyTrend.map((m, i) => (
                  <div key={m.month} className={i === lastTrendIndex ? "bar cur" : "bar"}>
                    <span className="num caption" style={{ marginBottom: 6 }}>
                      {formatYen(m.monthly)}
                    </span>
                    <div
                      className="col"
                      style={{ height: `${Math.round((m.monthly / maxTrend) * 100)}%` }}
                    />
                    <div className="lab">{Number(m.month.slice(5))}月</div>
                  </div>
                ))}
              </div>
              <ol className="mobile-trend-list mobile-only">
                {summary.monthlyTrend.map((m, i) => (
                  <li
                    key={m.month}
                    className={`mobile-trend-row${i === lastTrendIndex ? " current" : ""}`}
                  >
                    <span className="month">{Number(m.month.slice(5))}月</span>
                    <span className="mini-track" aria-hidden="true">
                      <span
                        style={{ width: `${Math.round((m.monthly / maxTrend) * 100)}%` }}
                      />
                    </span>
                    <span className="num amount">{formatYen(m.monthly)}</span>
                  </li>
                ))}
              </ol>
              <p className="caption" style={{ marginTop: 12 }}>
                各月末までに登録済みの継続中契約の月額合計。登録が増えるほど積み上がります。
              </p>
            </>
          )}
        </div>
      </section>

      {/* カテゴリ別内訳 */}
      <section className="section">
        <div className="sechead">
          <h2 className="title">カテゴリ別内訳</h2>
        </div>
        <div className="panel cat">
          {summary.byCategory.length === 0 ? (
            <p className="caption" style={{ margin: 0 }}>
              継続中の契約がありません。
            </p>
          ) : (
            summary.byCategory.map((c, i) => {
              const pct = Math.round(c.share * 100);
              return (
                <div
                  key={c.category}
                  className="catrow"
                  style={i === summary.byCategory.length - 1 ? { marginBottom: 0 } : undefined}
                >
                  <div className="top">
                    <span>{categoryLabel(c.category)}</span>
                    <span className="pct">
                      {formatYen(c.monthly)} ・ {pct}%
                    </span>
                  </div>
                  <div className="track">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
