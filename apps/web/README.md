# SubBuddy（Web / `apps/web`）

サブスクの「継続／解約」をルールベースで提案する、**ローカルファースト**の個人向け管理アプリ（MVP）。
判定は AI を使わず、利用状況としきい値（`src/config/scoring.ts`）から決まります。

> **PII 方針（厳守）**：開発・テスト・サンプルには**合成（ダミー）データのみ**を使います。
> 実在の契約・請求・利用ログ・メール等の個人データは参照・生成・コミットしません（`CLAUDE.md` 準拠）。
> 実データは実行時にローカル DB にのみ保存されます。`.env` 等の秘密情報はコミットしません。

## 技術スタック

- Next.js 16（App Router / Route Handlers）+ React 19 + TypeScript（strict）
- Tailwind CSS v4 / Prisma 6 + PostgreSQL 15 / Zod 4 / Vitest 4

## 前提

- Node.js 24.16.0（`.tool-versions` 参照）
- PostgreSQL 15（ローカル）

docker 無し環境では、付属スクリプトでローカル DB を用意できます：

```bash
bash scripts/setup-local-db.sh   # ロール subbuddy / DB subbuddy_dev を作成
```

## セットアップ

```bash
# 1. 依存関係
npm install

# 2. 環境変数（ダミー値。実値は各自のローカルに合わせて .env を作成）
cp .env.example .env
#   DATABASE_URL="postgresql://subbuddy:subbuddy@localhost:5432/subbuddy_dev?schema=public"

# 3. マイグレーション適用 ＋ Prisma クライアント生成
npx prisma migrate deploy   # 既存マイグレーションを適用
npx prisma generate

# 4. 合成データ投入（強解約候補/解約検討/重複/様子見/iCloud+/継続/観測中）
npm run db:seed
```

## 起動

```bash
npm run dev                  # 開発サーバ（http://localhost:3000）
npm run build && npm run start  # 本番ビルド確認
```

主な画面：

| パス | 内容 |
|---|---|
| `/` | ダッシュボード（月額/年額合計・強い解約候補/更新間近件数・再計算） |
| `/subscriptions` | サブスク一覧（判定バッジ・観測中「あと N 日」） |
| `/subscriptions/new` `/subscriptions/[id]` `/…/edit` | 登録・詳細・編集 |
| `/recommendations` | 判定別レコメンド |
| `/renewals` | 更新間近 |

## API（Route Handlers）

| メソッド | パス | 用途 |
|---|---|---|
| GET/POST | `/api/subscriptions` | 一覧 / 登録 |
| GET/PUT/DELETE | `/api/subscriptions/[id]` | 詳細 / 更新 / 削除 |
| GET | `/api/summary` | 月額/年額合計・件数 |
| POST | `/api/usage/daily` | 利用量同期（**冪等 upsert**・不正は 400） |
| GET | `/api/recommendations` | 最新スナップショット一覧 |
| POST | `/api/recommendations/recompute` | 全件再計算 |
| GET | `/api/renewals/upcoming?days=14` | 更新間近 |
| GET | `/api/service-catalog` | 正規化辞書 |

利用量同期の例（合成データ。同一 `subscriptionId × date` の再送で行は増えません）：

```bash
curl -X POST http://localhost:3000/api/usage/daily \
  -H 'content-type: application/json' \
  -d '{"items":[{"subscriptionId":"<ID>","date":"2026-06-04","used":true,"usageBucket":"30m_plus"}]}'
```

## テスト・品質チェック

```bash
npm run test        # Vitest（domain / schemas / config / repositories の単体テスト）
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

## 判定ロジックの要点

- **段階的な情報提供（案A）**：利用集計は登録時点（`subscriptions.created_at`）から開始。
  観測日数が `minObservationDays`（既定14）未満の間は確定判定を保留し「観測中（あと N 日）」と表示。
  重複・更新間近などの**利用に依存しない指摘は登録直後から**表示します。
- 利用計測データが1件も無い契約（iCloud+ 等の計測対象外）は、未使用日数を確定できないため
  利用ベースの解約判定を出しません（誤った強い解約候補を避ける）。
- しきい値はすべて `src/config/scoring.ts`（Zod 検証）に外出しされ、テストで差し替え可能です。

## ディレクトリ

```
src/
├── app/(dashboard)/   画面（ダッシュボード・一覧・詳細・レコメンド・更新間近）
├── app/api/           Route Handlers
├── domain/            集計・スコアリング（純関数・副作用なし）
├── services/          再計算の orchestration
├── repositories/      Prisma アクセス（DB 操作はここに限定）
├── schemas/           Zod（入力検証）
├── config/            しきい値（scoring）
├── components/        共通 UI（Tailwind）
└── lib/               通貨・日付・表示などの横断ユーティリティ
```

## 対象外（本 MVP）

iOS アプリ（Screen Time 連携）／請求メール抽出／iCloud+ 容量管理 UI ／クラウド多ユーザー化・認証 ／AI 理由文生成。
