# design.md — 支出の可視化（実装設計）

## 1. 構成

```
listSubscriptions (repository)
        │  Subscription[]
        ▼
aggregateSpending (domain/spending/aggregate.ts ・純粋関数)
        │  SpendingSummary
        ├──────────────► GET /api/spending/summary (Route Handler)
        └──────────────► /spending ページ (Server Component・仮UI)
```

集計ロジックは画面・API から独立した純粋関数に置き、現在時刻は `referenceDate` で受け取る（テスト容易性）。

## 2. 集計の定義

| 指標 | 定義 |
|---|---|
| `monthlyTotal` | active 契約の月額換算（`toMonthlyAmount`）合計 |
| `yearlyTotal` | active 契約の年額換算（`toYearlyAmount`）合計＝年額見込み |
| `byCategory[]` | カテゴリ別の月額合計と構成比（`share = monthly / monthlyTotal`）。月額降順 |
| `monthlyTrend[]` | 直近 `windowMonths`（既定6）各月末時点で「登録済み（`createdAt` が翌月1日より前）かつ現在 active」の月額合計。古い→新しい順 |

> 月次推移は解約日を保持していないため、現在 active な契約を母集団に「登録の積み上がり」を表す近似。
> 実支出推移（請求履歴ベース）はポストMVP の課題。

## 3. 型（`domain/spending/aggregate.ts`）

- `SpendingSubscriptionInput`（amount/billingCycle/category/status/createdAt）
- `SpendingSummary`（monthlyTotal/yearlyTotal/activeCount/byCategory/monthlyTrend）
- `aggregateSpending(subs, { referenceDate, windowMonths })`

金額はすべて最小通貨単位の整数（円）。`lib/money.ts` を再利用。

## 4. 仮UI（`/spending`）

- 合計カード（月額・年額見込み）。
- カテゴリ別内訳：横バー（幅＝構成比%）＋金額・%。
- 月次推移：縦バー（高さ＝`monthly/maxTrend`）＋月ラベル・金額。
- 既存 zinc デザインシステムのみ使用（仕上げは別途）。

## 5. 影響範囲

- 追加：`domain/spending/aggregate.ts`、`aggregate.test.ts`、`api/spending/summary/route.ts`、`(dashboard)/spending/page.tsx`。
- 変更：`(dashboard)/layout.tsx`（ナビに「支出の可視化」1項目）。
- データモデル変更なし（読み取り集計のみ）。`docs/` への必須変更なし。
