# iCloud+ 容量ゲート判定の実装：タスクリスト

> ステアリング：`.steering/20260623-icloud-plus-capacity-gate/`
> 作成日：2026-06-23
> 前提：`requirements.md`・`design.md`（承認済み）
> 状態凡例：未着手 / 進行中 / 完了

---

## フェーズ0：第1段（重複クラウド費用の発見）＝既存確認のみ

> 実コード確認済み：iCloud+・Google One・Dropbox・OneDrive は seed 登録済み（`cloud_storage`・代替関係・iCloud+ は `capacity`）。**新規登録は不要**。検証に絞る。

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 0-1 | seed のクラウド各社登録（カテゴリ・代替・usageType）が正しいことを検証する | iCloud+ が `cloud_storage`／`capacity`、代替に Google One 等がある | 完了 |
| 0-2 | 合成データで iCloud+ に「重複で割高／安い競合がある」判定が出ることを確認する | 既存 P2/P4 が iCloud+ に対して発火し根拠が出る | 完了 |

---

## フェーズ1：データモデル・しきい値

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 1-1 | `Subscription` に `planCapacityGb`・`usedCapacityGb`・`capacityCheckedAt`（すべて任意）を追加しマイグレーションする | マイグレーション成功。既存データは全フィールド null | 完了 |
| 1-2 | `ServicePlan` に `capacityGb`（任意）を追加しマイグレーションする | マイグレーション成功。容量ゲートが対象プランの容量を数値で参照できる | 完了 |
| 1-3 | seed の iCloud+ 各プランに `capacityGb`（50／200／2000）を付与する | seed 投入後、iCloud+ プランに容量が入る | 完了 |
| 1-4 | `schemas/subscription.ts` に容量3フィールド（任意）を追加する | Zod バリデーションが通る | 完了 |
| 1-5 | `config/scoring.ts` に `capacityFreshnessDays(30)`・`capacitySafetyBufferGb(5)`・`capacitySafetyBufferRatio(0.1)` を追加する | スキーマ検証が通り既定値が入る。`scoring.test.ts` に既定値アサートを追加 | 完了 |

---

## フェーズ2：収まる最小プラン選択（純粋関数）

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 2-1 | `domain/capacity/fit.ts` に `smallestFittingPlan`（使用量＋安全バッファが収まる中で最小容量のプランを返す）を実装する | 収まる候補が無ければ null。安全バッファ＝max(固定GB, 容量×割合)を反映 | 完了 |
| 2-2 | `domain/capacity/fit.test.ts` を実装する | 収まる/収まらない境界・複数候補から最小選択・候補なしがパスする | 完了 |

---

## フェーズ3：判定ロジック（既存 P3 へのゲート追加）

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 3-1 | `RecommendationInput` に `usedCapacityGb`・`daysSinceCapacityCheck`・`cheaperPlanCandidates`（容量つき候補・任意）を追加する | 型定義が通る。非 capacity は候補空配列 | 完了 |
| 3-2 | `MatchedPattern` に `status?: "confirmed" \| "needs_capacity_check"` を追加する（`type` エイリアスのまま） | 既定 confirmed。他パターンに影響しない | 完了 |
| 3-3 | `parseMatchedPatterns`／`isMatchedPattern`（`matchedPatterns.ts`）を `status` を保持するよう改修する | スナップショットから読み戻しても status が落ちない。詳細画面で確認待ち/確定を区別できる | 完了 |
| 3-4 | P3 ブランチに容量ゲート分岐を実装する（design §6.3、`smallestFittingPlan` を使用） | 容量なし→needs_capacity_check／鮮度OK＋収まる最小プランあり→confirmed＋cheaperPlan差し替え／収まらない→非該当／鮮度切れ→needs_capacity_check | 完了 |
| 3-5 | evidence 文言を `computeRecommendation.ts` の P3 分岐で3段生成する（reasons.ts ではない） | 3状態の evidence ＋「データは消えない・Apple画面で確認」が出る | 完了 |
| 3-6 | `determineDecision` に status の反映を実装する | confirmed→consider_downgrade、needs_capacity_check→review。他パターン優先順位は不変 | 完了 |
| 3-7 | 非 capacity サブスクの P3 が従来どおり動くことを保証する | usageType≠capacity では status 既定 confirmed・ゲート無効 | 完了 |

---

## フェーズ4：recompute.ts の拡張

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 4-1 | iCloud+ で `usedCapacityGb`・`capacityCheckedAt` を取得し入力に詰める | 容量フィールドが渡る | 完了 |
| 4-2 | `daysSinceCapacityCheck` を `capacityCheckedAt` から算出する（null 可） | 鮮度日数が正しく計算される | 完了 |
| 4-3 | 既存の知識ベース取得（ServicePlan・isFreeTier除外・自分より安い）に `capacityGb` を載せ `cheaperPlanCandidates` として渡す | 容量つき候補が P3 ゲートに渡る。価格・陳腐化補正は既存ロジックを再利用 | 完了 |

---

## フェーズ5：表示の正確性ガード（UI ラベル）

> evidence 文言の生成はフェーズ3-5（`computeRecommendation.ts`）に移管済み。ここは数値表示のラベル付けに絞る。

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 5-1 | 節約額（`annualSavingsIfDowngraded`）の年換算に「月額×12の目安」ラベルを付ける | 実在の年額プランに見せない表記になる | 完了 |
| 5-2 | `status === "needs_capacity_check"` のとき節約額を確定額として出さない | 「容量確認後に判定」と添えられる | 完了 |

---

## フェーズ6：UI（just-in-time 容量入力）

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 6-1 | iCloud+ 詳細で「使用容量を確認」導線を出す | オンボーディングには出さず、容量型サブスクの詳細でのみ表示。※実装は「needs_capacity_check のときだけ」より広く、容量型では常時編集可とした（いつでも更新できる方がUX上良いため）。安全条件の文言は判定の reason（evidence＋caveat）に含めて表示 | 完了 |
| 6-2 | 容量入力 UI（プラン容量＝選択式／使用容量＝数値）を実装する | 無料枠5GBは選択肢に出さない。保存で capacityCheckedAt 更新 | 完了 |
| 6-3 | 安全条件の文言（同期影響・次回請求から・確認方法）を表示する | ダウングレード提案時に安全条件が表示される | 完了 |

---

## フェーズ7：テスト

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 7-1 | 容量ゲートのユニットテストを `computeRecommendation.test.ts` に追加する | design §11 の8観点がパスする | 完了 |
| 7-2 | しきい値差し替えで境界が動くことをテストする | config 変更で収まり/鮮度の境界が変わる | 完了 |
| 7-3 | 既存テスト・E2E が壊れないことを確認する | `npm run test`・`npm run test:e2e` が全件パス | 完了 |

---

## フェーズ8：ドキュメント改訂

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 8-1 | `docs/product-requirements.md` 6.3 を改訂する（体験ゴール・3段出し分け・正確性制約） | 容量ゲート方針が反映される。内部項番は使わず内容を表す名前で記述 | 完了 |
| 8-2 | `docs/functional-design.md` の判定ルールに容量ゲートを追記する | 「新パターンではなく安いプラン判定への安全弁」と明記 | 完了 |
| 8-3 | `docs/glossary.md` に用語を追加する | 使用容量・プラン容量・鮮度・スコープの定義が載る | 完了 |

---

## フェーズ9：品質チェック・受け入れ確認

| # | タスク | 完了条件 | 状態 |
|---|---|---|---|
| 9-1 | requirements.md の AC-1〜AC-8 を全件確認する | 全件パス | 完了 |
| 9-2 | リント・型チェックをパスする | `npm run lint`・`npm run typecheck` がエラーなし | 完了 |
| 9-3 | 新パターンを追加していないことをレビューで確認する | 判定パターン集合が P1〜P7 のままである | 完了 |
