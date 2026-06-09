# 定量レコメンドエンジンの実装：タスクリスト

> ステアリング：`.steering/20260609-quantitative-recommendation-engine/`
> 作成日：2026-06-09
> 前提：`requirements.md`・`design.md`（承認済み）

---

## フェーズ1：データモデル・スキーマ変更

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 1-1 | ServiceCatalog に `usageType` フィールドを追加する | マイグレーション成功。既存データに `active_foreground` がデフォルト設定される | 完了 |
| 1-2 | ServicePlan テーブルを新規作成する | マイグレーション成功。`name`, `monthlyPrice`, `isFreeTier`, `verifiedAt`, `sourceUrl` を持つ | 完了 |
| 1-3 | ServiceAlternative テーブルを新規作成する | マイグレーション成功。`fromServiceId`, `toServiceId`, `relation` を持つ | 完了 |
| 1-4 | Subscription に `matchedServiceId`, `usageType`, `initialValueAnswer` を追加する | マイグレーション成功。既存データは `matchedServiceId=null`, `usageType=active_foreground`, `initialValueAnswer=null` | 完了 |
| 1-5 | `schemas/usage.ts` の `source` に `ios_shortcut` を追加する | Zod スキーマのバリデーションが通る | 完了 |
| 1-6 | `schemas/subscription.ts` に `matchedServiceId`, `usageType`, `initialValueAnswer` を追加する | Zod スキーマのバリデーションが通る | 完了 |

---

## フェーズ2：サービス知識ベースの構築

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 2-1 | `prisma/seed/service-catalog.json` に主要50件のサービスデータを作成する | JSON が有効。各サービスに `canonicalName`, `category`, `usageType`, `commonAliases`, `plans`, `alternatives` がある | 完了 |
| 2-2 | seed スクリプトを更新し、service-catalog.json から ServiceCatalog・ServicePlan・ServiceAlternative に投入する | `npx prisma db seed` で全件投入される | 完了 |
| 2-3 | 知識ベースの料金に無料プランが含まれる場合 `isFreeTier=true` を設定する | 無料プランが P3/P4 の比較対象から除外されることをテストで確認 | 完了 |

---

## フェーズ3：パターン判定ロジックの実装

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 3-1 | `config/scoring.ts` をパターン判定用しきい値に変更する | `p1WatchLastUseDays(31)`, `p1CancelLastUseDays(61)`, `renewalSoonDays(7)`, `highCostThreshold(2000)`, `longContractMonths(12)`, `knowledgeBaseStaleDays(180)`, `staleConfidenceMultiplier(0.7)` が定義される | 完了 |
| 3-2 | `computeRecommendation.ts` の入力型に `usageType`, `usageDaysInSpan`, `judgmentSpanDays`, `contractMonths`, `cumulativeSpend`, `cheaperPlan`, `cheaperAlternative`, `cheapestInCategory`, `initialValueAnswer` を追加する | 型定義が通る | 完了 |
| 3-3 | `computeRecommendation.ts` の出力型に `matchedPatterns`, `annualSavingsIfCancelled`, `annualSavingsIfDowngraded` を追加する | 型定義が通る | 完了 |
| 3-4 | P1（使っていない）の判定ロジックを方式C（スパン内利用日数＋最終利用経過日数）で実装する | `usage_type` 別の分岐、判定スパン（月額30日/年額365日）の切り替え、4パターンの分岐が動作する | 完了 |
| 3-5 | P2（重複で割高）の判定ロジックを実装する | 同カテゴリ内の最安月額と比較し、自分が最安でなければ該当する | 完了 |
| 3-6 | P3（安いプランがある）の判定ロジックを実装する | ServicePlan から自分より安い有料プランを取得。`isFreeTier=true` は除外。陳腐化補正（`verifiedAt` 6ヶ月超過で信頼度低下）を適用 | 完了 |
| 3-7 | P4（安い競合がある）の判定ロジックを実装する | ServiceAlternative + ServicePlan から自分より安い有料競合を取得。`isFreeTier=true` は除外。陳腐化補正を適用 | 完了 |
| 3-8 | P5（更新が近い）の判定ロジックを実装する | 年額契約かつ更新日7日以内で該当 | 完了 |
| 3-9 | P6（高額で長期継続）の判定ロジックを実装する | 月額¥2,000以上かつ契約12ヶ月以上で該当 | 完了 |
| 3-10 | Decision 決定関数を実装する | 複数パターン該当時に最も強い Decision を採用。P1 の解約検討/様子見の分岐が正しく動作する | 完了 |
| 3-11 | `reasons.ts` をパターン別の理由文生成に書き換える | 各パターンの `evidence` と `caveat` を含む理由文が生成される | 完了 |
| 3-12 | 年間節約額の算出を実装する | `annualSavingsIfCancelled`（年額）と `annualSavingsIfDowngraded`（P3 該当時のみ）が正しく計算される | 完了 |

---

## フェーズ4：recompute.ts の拡張

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 4-1 | `recompute.ts` で `usageType` を Subscription から取得し、入力に渡す | `usage_type` が `computeRecommendation` に渡される | 完了 |
| 4-2 | 契約期間（`contractMonths`）と累計支払額（`cumulativeSpend`）を自動算出する | 登録日からの月数と料金×月数が正しく計算される | 完了 |
| 4-3 | 判定スパン（`judgmentSpanDays`）を `billingCycle` から決定する | 月額→30日、年額→365日 | 完了 |
| 4-4 | スパン内利用日数（`usageDaysInSpan`）を利用記録から集計する | `ios_usage_daily_summaries` から判定スパン内の `used=true` のレコード数を集計 | 完了 |
| 4-5 | 知識ベースから P3 用の安い有料プランを取得する | `matchedServiceId` がある場合に `ServicePlan` から取得。`isFreeTier` 除外。陳腐化補正 | 完了 |
| 4-6 | 知識ベースから P4 用の安い有料競合を取得する | `ServiceAlternative` + `ServicePlan` から取得。`isFreeTier` 除外。陳腐化補正 | 完了 |
| 4-7 | P2 用の同カテゴリ最安月額を算出する | 同カテゴリの他サブスクの月額から最安値を算出 | 完了 |

---

## フェーズ5：登録 UI の変更

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 5-1 | サービス名入力にあいまい検索（Fuse.js）を導入する | `canonicalName` + `commonAliases` を検索対象に、全角/半角・大小文字・カタカナ/ひらがなの正規化が動作する | 完了 |
| 5-2 | カタログ候補の選択 UI を実装する | 候補一覧から選択すると `matchedServiceId`, `usageType`, `category` が自動設定される | 完了 |
| 5-3 | 「新しいサービスとして登録」の導線を実装する | カタログにない場合にカテゴリと `usage_type` をユーザーが選べる。選択肢は平易な表現で表示 | 完了 |
| 5-4 | 初回1問（「なくなったら困りますか？」）の UI を実装する | 「すぐ困る/少し困る/あまり困らない」の3択＋スキップ。回答が `initialValueAnswer` に保存される | 完了 |

---

## フェーズ6：レコメンド表示 UI の変更

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 6-1 | レコメンド一覧画面にパターンバッジと根拠を表示する | 各サブスクに Decision バッジ＋該当パターンの evidence が表示される | 完了 |
| 6-2 | 詳細画面にパターン別の根拠・caveat・節約額を表示する | 該当した全パターンが列挙され、節約額が表示される | 完了 |
| 6-3 | 詳細画面に QR コード表示ボタンを追加する | `usage_type` が `active_foreground` または `active_background` のサブスクにのみ表示。QR コードに API URL と subscriptionId が含まれる | 完了 |

---

## フェーズ7：Shortcuts 連携

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 7-1 | `/api/usage/daily` で `source: "ios_shortcut"` のリクエストを受け付ける | curl で `source: "ios_shortcut"` を送信し、DB に保存されることを確認 | 完了 |
| 7-2 | QR コード生成を実装する | サブスク詳細画面で QR コードが表示され、API URL と subscriptionId が含まれる | 完了 |

---

## フェーズ8：テスト

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 8-1 | `computeRecommendation.test.ts` をパターン判定のテストに書き換える | P1〜P7 の各パターンについて、該当/非該当のテストケースがパスする | 完了 |
| 8-2 | P1 の方式C（スパン＋最終利用日）のテストを実装する | requirements.md §4.1 の具体例7件がすべてテストケースとしてパスする | 完了 |
| 8-3 | `usage_type` 別の P1 適用可否テストを実装する | `passive` と `entitlement` で P1 が適用されないことを確認 | 完了 |
| 8-4 | 知識ベースの陳腐化テストを実装する | `verifiedAt` が6ヶ月前のプランで信頼度が0.7に低下することを確認 | 完了 |
| 8-5 | 無料プラン除外テストを実装する | `isFreeTier=true` のプランが P3/P4 の比較対象から除外されることを確認 | 完了 |
| 8-6 | 既存の E2E テストが壊れないことを確認する | `npm run test:e2e` が全件パスする | 完了 |

---

## フェーズ9：ドキュメント改訂

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 9-1 | `docs/product-requirements.md` §1（ビジョン・中心価値）を改訂する | 「利用量」→「パターン判定」に変更 | 完了 |
| 9-2 | `docs/product-requirements.md` §8.3（判定ルール）をパターン P1〜P7 に置換する | 旧ルール（60日未使用→strong_cancel等）が新パターンに置き換わる | 完了 |
| 9-3 | `docs/product-requirements.md` §8.5（段階的提供）を `usage_type` 方式に改訂する | 利用の性質による適用可否マトリクスが記載される | 完了 |
| 9-4 | `docs/product-requirements.md` §10.0/10.1 を改訂する | 「利用量＝MVP中核」→「パターン判定方式が中核。利用量は P1 の判定手段」に変更 | 完了 |
| 9-5 | `docs/functional-design.md` §8 の判定ルールを改訂する | パターン判定方式に合わせて更新 | 完了 |

---

## フェーズ10：品質チェック・受け入れ確認

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 10-1 | requirements.md の受け入れ条件 AC-1〜AC-11 を全件確認する | 全件パス | 完了 |
| 10-2 | 合成データで各 `usage_type` のサブスクを登録し、レコメンドが正しく出ることを確認する | `active_foreground`, `active_background`, `active_other_device`, `passive`, `entitlement` の各タイプでレコメンドが出る | 完了 |
| 10-3 | リント・型チェックをパスする | `npm run lint` と `npm run typecheck` がエラーなし | 完了 |
