# 引き継ぎ書（iCloud+ 容量ゲート）

> 作成：2026-06-23 / 次セッションはまずこの1枚を読めば再開できる。
> ブランチ：`feat/spending-and-design` / **全変更は未コミット**。

---

## 1. 現在地（ひとことで）

iCloud+（`usage_type=capacity`）の「下位プランで足りるか」を**安全に**判定する**容量ゲート**を実装完了。
方針＝**新パターンを作らず、既存の「安いプランがある（P3）」に容量の安全弁を足す**。
品質ゲート全通過（typecheck / lint / 96 unit tests / E2E exit 0）。**未コミット**。

---

## 2. 確定した設計判断（Claude×Codex 議論で収束）

- 使用容量は全サブスク必須ではない。**P3 を安全に出すためのゲート条件**としてのみ必要。
- 出し分け3段：**容量なし→needs_capacity_check（review・断定しない）／鮮度OK＋安全に収まる最小プランあり→confirmed（consider_downgrade）／鮮度切れ→needs_capacity_check**。
- 安全に収まる＝`使用量 + max(bufferGb, 下位容量×ratio) ≤ 下位容量`。しきい値は `config/scoring.ts`。
- 容量入力は just-in-time（オンボーディング必須にしない）。OCR は別スパイク。
- 正確性ガード：価格は一意でない（目安）／年額は月額×12の目安／「データ消える」と断定しない。

詳細＝同ディレクトリ `requirements.md` / `design.md` / `tasklist.md`（全タスク「完了」）。
ナレッジ＝`obsidian/2026-06-23_icloud-plus-capacity-gate-for-downgrade.md`。意義＝`memory/icloud-plus-management-value.md`。

---

## 3. 変更ファイル（すべて `apps/web/`）

**新規**
- `src/domain/capacity/fit.ts`（+ `fit.test.ts`）：`smallestFittingPlan` / `fitsPlan`
- `src/components/CapacityInput.tsx`：詳細画面の容量入力（PUT→再計算→refresh）

**変更**
- `prisma/schema.prisma`：`Subscription` に `planCapacityGb`/`usedCapacityGb`/`capacityCheckedAt`、`ServicePlan` に `capacityGb`（すべて任意）
- `prisma/migrations/20260623124517_add_capacity_gate/`（適用済み）
- `prisma/seed.ts` + `prisma/seed/service-catalog.json`：iCloud+ プランに `capacityGb`、iCloud+ サブスクのカテゴリを `storage`→`cloud_storage` に修正（重複検知の不具合直し）＋ matchedServiceId/容量データ投入、Dropbox に matchedServiceId
- `src/config/scoring.ts`（+ `scoring.test.ts`）：`capacityFreshnessDays(30)`/`capacitySafetyBufferGb(5)`/`capacitySafetyBufferRatio(0.1)`
- `src/domain/scoring/computeRecommendation.ts`：`MatchedPattern.status` 追加、入力に容量3項目、`resolveP3`（容量ゲート本体）、`determineDecision` に status 反映
- `src/domain/scoring/matchedPatterns.ts`：`parseMatchedPatterns`/`isMatchedPattern` を `status` 保持に改修（**読み戻しの穴の修正**）
- `src/services/recompute.ts`：容量つき候補 `cheaperPlanCandidates`・鮮度・使用容量を入力に
- `src/schemas/subscription.ts` + `src/repositories/subscriptions.ts`：容量3項目の検証・create/update 永続化
- `src/app/(dashboard)/subscriptions/[id]/page.tsx`：容量入力UI表示・年額換算の「目安」ラベル
- `docs/product-requirements.md`(6.3) / `docs/functional-design.md`(§8.2) / `docs/glossary.md`：方針・用語を改訂
- `computeRecommendation.test.ts`：容量ゲート＋しきい値差し替えテスト

---

## 4. サンプルでの動作確認（再seed済み）

- **Dropbox** → consider_cancel：P2「同カテゴリに¥400/月のサービスがあります」＋P4「iCloud+（¥130/月）」
- **iCloud+ 200GB** → consider_cancel：P3(confirmed)「現在の使用容量なら50GB（¥130/月の目安）で足ります（※同期等に影響、Apple画面で確認）」＋P4「Google One（¥250/月）」

確認コマンド例：`npx tsx <recomputeRecommendations("user_local") を呼ぶ小スクリプト>`。

---

## 5. 再開時の最初の一手

1. `cd apps/web && npm run typecheck && npm test`（緑を確認）。DB未起動なら PostgreSQL を手動起動（[[dev-env-quirks]]）。
2. 必要なら **コミット**（ユーザー未指示。`feat/spending-and-design`）。コミット前に pre-commit-secret-scan を通す方針。
3. ブラウザ確認：iCloud+/Dropbox 詳細で「判定を再計算」→ 表示反映を目視。

---

## 6. 残・別スパイク（今回スコープ外）

- スクリーンショット OCR の実装（iPhone Vision。仕様は別途検討済み）
- 家族共有スコープ（個人／家族全体）の本格モデリング → `CapacityUsageSnapshot` テーブルへの移行
- 値上げアラート（外部データ依存）
- E2E は exit 0 だが、ログがフォント取得失敗の警告で埋まり Playwright 件数サマリは未確認。厳密確認なら再実行。

---

## 7. 既知の小さな申し送り

- UI(6-1)は「needs_capacity_check のときだけ」より広く、**容量型サブスクの詳細では常時**容量編集可とした（いつでも更新できる方がUX上良い）。
- 安全条件の文言は判定の `reason`（evidence＋caveat）として表示される（専用UI枠ではない）。
