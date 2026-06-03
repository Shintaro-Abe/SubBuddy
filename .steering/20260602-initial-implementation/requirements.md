# 初回実装 — 要求内容（requirements）

> ステアリング：`20260602-initial-implementation`
> ドキュメント種別：作業単位ドキュメント（`.steering/`）
> 作成日：2026-06-02
> 関連：`docs/product-requirements.md`、`docs/functional-design.md`、`docs/architecture.md`、`docs/repository-structure.md`、`docs/development-guidelines.md`、`docs/glossary.md`

---

## 1. 今回の作業の目的

SubBuddy の **Mac 側（Next.js Web + API）の中核を、合成データで end-to-end に動作させる**初回実装。
「サブスクを登録 → 利用量・請求を取り込み → ルールベースで見直し提案を表示」という**コア価値の縦串**を最小構成で通すことを目的とする。

- ローカルファースト・単一ユーザーの MVP（`architecture.md` §1）。常時起動の macOS 上の localhost で動作。
- **iOS センサー（Swift アプリ）は本作業の対象外**。利用量は「集計値を受ける同期 API」を実装し、**合成データの POST で検証**する（iOS 実機連携は別ステアリングに切り出す）。

---

## 2. スコープ

### 2.1 今回やること（In Scope）

1. **プロジェクト雛形**：`apps/web/`（Next.js App Router / TypeScript strict / Tailwind / Prisma + PostgreSQL / Zod / Vitest / ESLint・Prettier）。`repository-structure.md` §4 の構成に準拠。
2. **データモデル**：`functional-design.md` §5 の 5 テーブル（`subscriptions` / `billing_events` / `ios_usage_daily_summaries` / `recommendation_snapshots` / `service_catalog`）を Prisma で定義・マイグレーション。全テーブルに `user_id`。
3. **合成 seed**：`prisma/seed.ts` で**合成データのみ**（実 PII 禁止）。表記揺れ正規化・除外対象（Apple Music 等 `is_excluded`）を含む。
4. **サブスク登録・編集・一覧・詳細**（UC-01 / UC-02）：CRUD、月額/年額合計の集計表示、判定バッジ。
5. **利用量同期 API**：`POST /api/usage/daily`（`functional-design.md` §10.1）。集計値バッチを Zod 検証し `subscription_id × usage_date` で**冪等 upsert**。iOS クライアントは作らず、合成 POST で検証。
6. **スコアリング（ルールベース）＋段階的提供（案A）**：`functional-design.md` §8 のルールを `src/domain/scoring/` に実装。しきい値・`minObservationDays` は `src/config/` に外出し（Zod 検証）。登録時点から集計し、観測不足時は「観測中（あと N 日）」、利用に依存しない指摘は即時。`recommendation_snapshots` に履歴保存（`data_status`/`observation_days`/`confidence` 含む）。`reason` は定型文。
7. **レコメンド表示**（UC-06）：判定別の一覧、単価（`cost_per_usage_day`）・理由・解約導線 URL の表示。
8. **ダッシュボード**：月額/年額合計、強い解約候補の件数、更新間近の件数。
9. **更新日前レビュー**（UC-03）：直近で更新が来るサブスクの一覧。
10. **品質土台**：scoring・normalize・Zod 境界・冪等 upsert の単体テスト（Vitest、合成データ）。lint / typecheck / test が通る状態。

### 2.2 今回やらないこと（Out of Scope）

- **iOS アプリ（Swift / Screen Time / 位置情報センサー）** — 別ステアリングで実装。
- **billing-email コネクタ（請求メール抽出）** — フェーズ2（`architecture.md` §5.1）。
- **ジム来館（`visit` / `cost_per_visit`）** — 取得方法が保留中（`.steering/20260601-anytime-fitness-visit-usage/`）。
- **iCloud+ 容量管理 UI（UC-08）** — 次スライド候補。今回は `capacity` 軸のデータモデル余地のみ確保し、画面は作らない。
- **クラウド多ユーザー化・正式認証（ポストMVP）** — `architecture.md` §4.2。
- **AI による理由文生成** — フェーズ2。

---

## 3. ユーザーストーリー

- US-1：ユーザーとして、契約中のサブスクを手動で登録し、月額・年額の合計を一目で把握したい。
- US-2：ユーザーとして、各サブスクの利用状況（利用日数・1利用日あたり単価）を見て、割高かどうかを判断したい。
- US-3：ユーザーとして、長期未使用や割高なサブスクを「見直し提案」として提示してほしい（ただし解約は自分で行う）。
- US-4：ユーザーとして、更新日が近いサブスクを事前に知り、不要なら更新前に対処したい。
- US-5（開発者視点）：iOS から送られる想定の集計値を、合成データの POST で投入し、提案が更新されることを確認したい。

---

## 4. 受け入れ条件（Acceptance Criteria）

- AC-1：`apps/web/` で開発サーバが起動し、Prisma マイグレーションと合成 seed が成功する。
- AC-2：サブスクを登録・編集・削除でき、一覧に月額/年額合計が正しく表示される。
- AC-3：`POST /api/usage/daily` に合成集計値バッチを送ると、同一 `subscription_id × usage_date` の再送で重複行が増えない（冪等）。不正ペイロードは Zod で 400。
- AC-4：スコアリングが `functional-design.md` §8 のルール通りに判定する（60日以上未使用→`strong_cancel_candidate` 等）。しきい値は `config` の値で変わる。
- AC-5：レコメンド画面で判定別に一覧表示され、単価・定型理由・解約導線 URL が出る。
- AC-6：ダッシュボードに月額/年額合計・強い解約候補件数・更新間近件数が表示される。
- AC-7：`review` の表示ラベルが「様子見」（`glossary.md` §4 と一致）。
- AC-7b：**段階的な情報提供（案A）**。登録直後は利用に依存しない指摘（重複・割高・更新間近）が即時表示され、利用ベース判定は観測日数が `minObservationDays`（既定14）未満の間「観測中（あと N 日）」と表示される。観測十分で確定判定に切り替わる（`functional-design.md` §8.5）。
- AC-8：scoring / normalize / Zod / 冪等 upsert の単体テストが通り、`lint` / `typecheck` / `test` が成功する。
- AC-9：seed・テスト・スクショに実 PII を含まない。`.env` 等の秘密情報はコミットされない。

---

## 5. 制約事項

- **PII・秘密情報を扱わない**：合成データのみ。実データの参照・生成・コミット禁止（`CLAUDE.md`）。
- **スクレイピング・自動ログイン・外部 ID/PW 保存は行わない**（恒久方針・TC-2）。
- **金額は整数（最小通貨単位）**で保持（`development-guidelines.md` §2）。
- **薄く始める**：未使用ディレクトリ・抽象を先回りで作らない（rule of three。`architecture.md` §5.1）。
- **ドメイン分離**：判定ロジックは `src/domain/` に集約し、API/UI から独立（Worker 分離の可搬性）。
- 言語・ツールのバージョン具体値は `package.json` / `.tool-versions` を一次情報とし、ドキュメントに固定しない。

---

## 6. 未確定・確認したい点

- (Q1) 利用量の取り込みは今回「同期 API ＋ 合成 POST」で十分か（コネクタ実装は薄く、`normalize` を経由する最小形でよいか）。
- (Q2) iCloud+ 容量（`capacity` 軸）は**データモデルの余地確保のみ**とし、UI・判定は次スライドに回す方針でよいか。
- (Q3) 認証は MVP のローカル簡易認証（`architecture.md` §8.1.1）を今回含めるか、初回は無認証 localhost 前提とし後続で足すか。
