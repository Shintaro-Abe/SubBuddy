# 初回実装 — タスクリスト（tasklist）

> ステアリング：`20260602-initial-implementation`
> ドキュメント種別：作業単位ドキュメント（`.steering/`）
> 作成日：2026-06-02
> 前提：`requirements.md` / `design.md`（承認済み・案A 段階的提供を反映）

進捗記号：`[ ]` 未着手 / `[~]` 着手中 / `[x]` 完了

---

## フェーズ0：プロジェクト雛形 ✅

- [x] T0-1 `apps/web/` に Next.js（App Router / TypeScript strict）を初期化（Next 16 / React 19）
- [x] T0-2 Tailwind CSS 導入（Tailwind v4・create-next-app テンプレート）
- [x] T0-3 ESLint / Prettier 設定（`eslint-config-next` ＋ `.prettierrc.json`・format スクリプト）
- [x] T0-4 Vitest 設定（`vitest.config.ts`・node 環境・`@` エイリアス）・スモークテスト（`src/lib/money.test.ts`）
- [x] T0-5 Prisma 導入（`prisma` / `@prisma/client`）・`.env.example`（ダミー値のみ。実 `.env` は `.gitignore`）
- [x] T0-6 `.tool-versions` 作成（`nodejs 24.16.0`）
- [x] T0-7 ディレクトリ骨格は**必要分のみ**作成（`src/lib`。他は各フェーズで都度追加・空ディレクトリは作らない）

**完了条件**：✅ `lint` / `typecheck` / `test`（4 passed）/ `build` がすべて通る。

---

## フェーズ1：データモデルと合成データ ✅

- [x] T1-1 `prisma/schema.prisma` に5テーブル（＋`users`）定義。全テーブルに `user_id`、金額は整数、列挙は Prisma enum
- [x] T1-2 `recommendation_snapshots` に段階的提供フィールド（`data_status` / `observation_days` / `days_until_ready` / `confidence`、`decision` は観測中 null 可）
- [x] T1-3 `ios_usage_daily_summaries` を `@@unique([subscriptionId, usageDate])` で定義（冪等 upsert 用）
- [x] T1-4 初回マイグレーション作成・適用（`20260603101154_init`。ローカル PostgreSQL 15）
- [x] T1-5 `prisma/seed.ts`：**合成データのみ**で8シナリオ（強解約候補/解約検討/重複/様子見/iCloud+/継続/観測中）→ user1・subs8・usage62・billing7
- [x] T1-6 `service_catalog`：Apple Music/TV+/Arcade/One を `isExcluded`＋表記揺れ最小辞書を seed

**完了条件**：✅ マイグレーションと seed が成功し、合成データで各判定・観測中が再現できる。実 PII なし。
**補足**：Prisma は v7 の設定方式（要 driver adapter）を避け、安定した **v6.19.3** に固定。ローカル DB セットアップは `scripts/setup-local-db.sh` で再現可能（docker 無し環境向け・apt PostgreSQL）。

---

## フェーズ2：検証スキーマ（Zod）

- [ ] T2-1 `src/schemas/` にサブスク登録/更新スキーマ（`subscriptionCreateSchema` / `subscriptionUpdateSchema`）
- [ ] T2-2 `usageDailyBatchSchema`（`subscriptionId` / `date` / `used` / `usageBucket` 列挙 / `estimatedMinutes*` / `source`、件数上限）
- [ ] T2-3 不正値・境界（列挙外・負の金額・min>max）の単体テスト

**完了条件**：API 入力・取り込みペイロードがすべて Zod 経由で検証される。境界テストが通る。

---

## フェーズ3：ドメイン（集計・正規化・スコアリング＋段階的提供）

- [ ] T3-1 `src/config/scoring.ts`：しきい値・`minObservationDays`（既定14）を Zod 検証付きで外出し（`scoringConfigSchema`）
- [ ] T3-2 `src/domain/usage/`：直近30日の利用日数・最終利用からの日数・バケット集計（純関数）＋ `usage/daily` 正規化（`normalize.ts`）
- [ ] T3-3 `src/domain/scoring/`：`computeRecommendation(input, config)` 純関数。**登録からの観測日数**を入力に含める
- [ ] T3-4 段階的提供（案A）：観測 < `minObservationDays` は `data_status='observing'`＋`days_until_ready` を返し、確定判定を保留
- [ ] T3-5 利用に依存しない指摘（同カテゴリ重複・割高・更新間近）は観測日数に関係なく算出
- [ ] T3-6 §8.3 判定ルール（60日→strong_cancel_candidate 等）と `cost_per_usage_day` 算出
- [ ] T3-7 `src/domain/scoring/reasons.ts`：判定別の定型文（観測中の定型文を含む）
- [ ] T3-8 単体テスト：判定網羅／**観測中⇄確定の境界（`minObservationDays` 前後）**／単価／config 差し替えで判定差分

**完了条件**：ドメインは副作用なしで、§8 と §8.5 の挙動がテストで保証される。

---

## フェーズ4：永続化（リポジトリ）

- [ ] T4-1 `src/repositories/`：subscriptions / usage / recommendations / service-catalog の Prisma アクセスを集約（ドメインから Prisma を直接呼ばない）
- [ ] T4-2 usage の `subscription_id × usage_date` 冪等 upsert を実装
- [ ] T4-3 `recommendation_snapshots` の追記（履歴保持）
- [ ] T4-4 冪等 upsert の単体テスト（同一バッチ再送で行が増えない）

**完了条件**：DB アクセスがリポジトリ経由に限定され、冪等性がテストで保証される。

---

## フェーズ5：API（Route Handlers）

- [ ] T5-1 `GET/POST /api/subscriptions`、`GET/PUT/DELETE /api/subscriptions/[id]`
- [ ] T5-2 `GET /api/summary`（月額/年額合計・件数）
- [ ] T5-3 `POST /api/usage/daily`（Zod 検証 → 冪等 upsert、不正は 400）
- [ ] T5-4 `GET /api/recommendations`（最新スナップショット）、`POST /api/recommendations/recompute`（全件再計算）
- [ ] T5-5 `GET /api/renewals/upcoming`（クエリ `days`、既定14）
- [ ] T5-6 `GET /api/service-catalog`
- [ ] T5-7 エラーレスポンスに内部情報・PII を含めない

**完了条件**：`design.md` §4 の契約どおり応答し、合成 POST で `usage/daily` の冪等性を確認できる。`/api/icloud-plus` は未実装（対象外）。

---

## フェーズ6：画面（UI / Tailwind）

- [ ] T6-1 ダッシュボード（月額/年額合計・強い解約候補件数・更新間近件数）
- [ ] T6-2 サブスク一覧（料金・更新日・判定バッジ。**観測中は「観測中 あと N 日」バッジ**）
- [ ] T6-3 サブスク登録/編集フォーム（Zod と整合・XSS 対策）
- [ ] T6-4 サブスク詳細（利用量・単価・判定理由・解約導線 URL。観測中は即時指摘＋観測中表示）
- [ ] T6-5 レコメンド画面（判定別一覧）
- [ ] T6-6 更新日前レビュー画面
- [ ] T6-7 共通 UI（`SubscriptionCard` 等）をコンポーネント化（クラス重複回避）

**完了条件**：合成データで全画面が表示され、`review`=「様子見」・観測中表示が `glossary.md` と一致。iCloud+ 容量管理画面は未実装（対象外）。

---

## フェーズ7：品質チェック・仕上げ

- [ ] T7-1 `lint` / `typecheck` / `test` がすべて green
- [ ] T7-2 主要導線の手動確認（登録 → usage 同期 → recompute → レコメンド/ダッシュボード表示）
- [ ] T7-3 （任意）E2E（Playwright）で主要導線1本
- [ ] T7-4 `pre-commit-secret-scan` 実行 → コミット（Conventional Commits、フィーチャーブランチ）
- [ ] T7-5 README に起動・seed・テスト手順を記載（合成データ前提）

**完了条件**：`requirements.md` の AC-1〜AC-9（AC-6b 含む）を満たし、品質チェックが通り、実 PII・秘密情報がコミットされていない。

---

## 対象外（本ステアリングで作らない）

- iOS アプリ（Swift / Screen Time / 位置情報センサー）— 別ステアリング
- 請求メール抽出コネクタ（フェーズ2）／ジム来館 `visit`・`cost_per_visit`（保留）
- iCloud+ 容量管理 UI（`/api/icloud-plus`・UC-08）— 次スライド（`capacity` はモデル余地のみ）
- クラウド多ユーザー化・正式認証（ポストMVP）／AI 理由文生成（フェーズ2）
- `ingestion/connectors/` の部品化（2例目の取得源が出た時点で着手＝rule of three）

---

## トレーサビリティ（受け入れ条件との対応）

| AC | 主担当タスク |
|---|---|
| AC-1 登録・一覧 | T5-1, T6-2, T6-3 |
| AC-2 合計 | T5-2, T6-1 |
| AC-3 冪等同期 | T1-3, T4-2, T5-3 |
| AC-4 判定ルール | T3-1, T3-6, T3-8 |
| AC-5 レコメンド表示 | T5-4, T6-4, T6-5 |
| AC-6 ダッシュボード | T5-2, T6-1 |
| AC-7 様子見ラベル | T3-7, T6-2 |
| AC-7b 段階的提供 | T3-3, T3-4, T3-5, T6-2, T6-4 |
| AC-8 品質・テスト | T2-3, T3-8, T4-4, T7-1 |
| AC-9 PII 非混入 | T1-5, T7-4 |
