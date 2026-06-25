# 引き継ぎ書（容量ゲート フォローアップ作業会）

> 作成：2026-06-25 / 次セッションはまずこの1枚を読めば再開できる。
> ブランチ：`feat/spending-and-design`
> 前提：`.steering/20260623-icloud-plus-capacity-gate/HANDOFF.md`（容量ゲート本体の引き継ぎ）

---

## 1. 現在地（ひとことで）

容量ゲート本体を **focused commit でコミット完了**（SHA `3cb37c9`）。
本作業会では (a) 容量入力UXの磨き込み、(b) 家族共有スコープの最小モデリング設計、(c) OCRスパイクの要件整理を実施。
品質ゲート：typecheck / eslint src / 96 unit tests すべて緑。

---

## 2. このセッションでやったこと

### ✅ コミット済み（SHA `3cb37c9`）
容量ゲート本体のみの focused commit（25ファイル）。secret-scan 検出ゼロ。無関係ファイル（devcontainer / mcp / research / talk-draft 等）は意図的に working tree に残置。

### ✅ 容量入力UXの磨き込み（`CapacityInput.tsx` ほか）＝**コミット済み `3d89fc9`**
3点を追加。typecheck / eslint / test 緑。
- **鮮度バッジ**：確認日からの経過日数を表示し、`capacityFreshnessDays`(30日) 超で「再確認をおすすめ」（amber・煽らないトーン。赤は strong_cancel 専用なので不使用）。
- **Apple確認リンク導線**：「設定 ＞ iCloud のストレージ画面」を Apple 公式ヘルプ（`https://support.apple.com/ja-jp/108922`・日本語・URL検証済み）への外部リンク化。
- **使用率表示**：入力中の値で「使用率◯%（used / plan GB）」＋細いバーを即時表示。
- **設計上の要点**：経過日数は現在時刻依存なので**描画層では計算しない**。`lib/display.ts` に `daysSince()` を追加し、サーバ（詳細ページ）で算出して prop で渡す（React 19 の purity / set-state-in-effect ルール準拠・ハイドレーション一致）。

変更ファイル（未コミット）：
- `apps/web/src/components/CapacityInput.tsx`（prop化・3UI追加）
- `apps/web/src/lib/display.ts`（`daysSince` 追加）
- `apps/web/src/app/(dashboard)/subscriptions/[id]/page.tsx`（`daysSinceCheck` prop 受け渡し）

### ✅ P3>P4 優先順位の変更（容量型のみ）＝**コミット済み `fee787d`**
検証で浮かんだプロダクト論点をユーザー承認のうえ実装。容量型（iCloud+）で P3=confirmed（安全に下げられる）のとき、他社代替（P4）より**同一サービス内の安全ダウングレード**を優先（`consider_downgrade`）。P2（重複割高）は引き続き上位。容量未確認（needs_capacity_check）や容量型以外は従来どおり。
- `apps/web/src/domain/scoring/computeRecommendation.ts`（`determineDecision` の順序：P2 → 容量型P3confirmed → P4 → P3）
- `apps/web/src/domain/scoring/computeRecommendation.test.ts`（+3ケース：容量型P3+P4→downgrade／needs_check時はP4勝ち／非容量型P3+P4→cancelは不変）。テスト 99 件全緑。
- `docs/functional-design.md` §8.2（優先順位の例外・容量ゲートの記述を更新）

### ✅ 設計ドキュメント（別スパイク・実装はしない）
- `.steering/20260625-capacity-gate-followup/design-family-scope.md`
  家族共有スコープの最小モデリング。`CapacityUsageSnapshot` への非破壊移行、`usageScope`/`costScope` 分離が判定に与える意味、移行5段階。
- `.steering/20260625-capacity-gate-followup/requirements-ocr.md`
  スクショOCR（iPhone Vision主）の要件。候補→確認→保存の3段・自動確定禁止・画像非保持。

---

## 3. 検証結果（バックグラウンドエージェント）

検証エージェントが recomputeRecommendations ＋ dev サーバ（HTTP 200）で確認。**容量ゲート本体は正しく動作**：

- **Dropbox** → `consider_cancel`（P2 重複割高＋P4 iCloud+ 代替）。期待どおり。
- **iCloud+ 200GB** → `consider_cancel`。P3 は **status=confirmed**・文言「現在の使用容量なら50GB（¥130/月の目安）で足ります（…Apple の画面で確認）」、P4「Google One（¥250/月）」も生成。**いずれも正しい**。

> ⚠️ 検証エージェントは当初これを「FAIL（期待 consider_downgrade）」と報告したが、これは**当方が渡した期待値の誤り**。元 HANDOFF（`20260623-…`）§4 も iCloud+ 200GB を `consider_cancel` と記載しており、**実挙動はドキュメントどおり**。`determineDecision`（`computeRecommendation.ts` 404行）は `hasP2 || hasP4 → consider_cancel` を P3→`consider_downgrade` より先に評価する設計（§6.4「より強い Decision を優先＝既存ルール不変」）。**バグではない。**

> 💡 上記プロダクト論点（容量型で安全ダウングレードを他社代替より優先すべきか）は、ユーザー判断のうえ**本セッションで実装済み**（下記参照）。iCloud+ 200GB は今後 `consider_downgrade` を返す。

---

## 4. 再開時の最初の一手

本セッションのコード変更は全てコミット済み（`3cb37c9` 容量ゲート本体 / `3d89fc9` UX磨き込み / `fee787d` P3>P4優先 / 本ステアリングのコミット）。**push/PR は未実施**。

1. `cd apps/web && npm run typecheck && npm test`（緑確認・99件）。DB未起動なら PostgreSQL 手動起動（[[dev-env-quirks]]：`sudo -n service postgresql start`）。
2. **ブラウザ目視**：iCloud+ 詳細で容量入力→保存→鮮度バッジ・使用率バーの反映、Apple リンク導線、judgment が `ダウングレード検討` になることを確認。
3. **ブランチ収束→PR**（トラック1）：UI刷新＋matchedPatterns＋容量ゲート＋本フォローアップをまとめて PR。working tree の無関係な未追跡/変更ファイルは関心ごとに分割。

---

## 5. 残・別スパイク（今回スコープ外）

- 家族共有スコープの**実装**（`CapacityUsageSnapshot` 追加・dual-write・usageScope 判定分岐）→ 設計は `design-family-scope.md`。着手判断は実需確認後でよい。
- OCR の**実装**（iPhone Vision 連携・単位正規化）→ 要件は `requirements-ocr.md`。実機スクショ精度の確認が先。
- ブランチ収束→PR（UI刷新＋matchedPatterns＋容量ゲート＋本UX磨き込みをまとめて）。トラック1として未着手。
- E2E 厳密再実行（Playwright 件数サマリ・フォント取得警告の切り分け）。

---

## 6. 申し送り（小）

- working tree には機能と無関係な未追跡/変更ファイルが多数残っている（devcontainer 文字化け修正・mcp/skills 整備・research ノート・talk-draft 等）。PR/コミット時は関心ごとに分割すること（容量ゲートは `3cb37c9` で既に分離済み）。
- 別 codex セッションが起動した dev サーバが本作業会中に稼働していた（別セッション由来・現在は終了）。turbopack のキャッシュ panic に注意（[[dev-env-quirks]]）。
