# SubBuddy

サブスクリプションの支出と利用状況をまとめ、継続・見直し・解約の判断材料を示す管理アプリです。

判断は AI ではなく、利用状況、料金、契約期間、更新日、同カテゴリの重複などを使ったルールベースの判定です。結論を断定せず、根拠を確認して利用者自身が判断できることを重視しています。

## 現在の実装

- サブスクの登録・一覧・詳細・編集・削除
- 月額・年額換算、カテゴリ別内訳、直近6か月の支出推移
- 利用状況と契約情報に基づくレコメンドと根拠表示
- 年額契約の更新間近表示
- 49サービスのカタログ検索、料金プラン・代替サービスとの比較
- iCloud+など容量型サービスの使用容量確認とダウングレード判定
- iPhoneのDeviceActivityで集計した利用量の同期
- ローカル単一ユーザー運用
- クラウド検証版向けのAppleサインイン、ユーザーごとのデータ分離、セッション・端末管理

### 判定の考え方

| 状況 | 表示する判断材料 |
|---|---|
| 一定期間使っていない | 解約候補または見直し候補 |
| 同カテゴリの契約が重複し、割高 | 解約候補 |
| 同じサービスに安い有料プランがある | ダウングレード候補 |
| 同カテゴリに安い代替サービスがある | 乗り換え候補 |
| 年額更新が近い | 更新前の確認 |
| 高額な契約を長期間継続している | 見直し候補 |
| 上記に該当しない | 継続 |

利用状況による判定は、サブスクの性質に応じて適用します。クラウドストレージのような受動利用や、会員特典の権利を持つこと自体に価値がある契約には、単純な未使用判定を適用しません。観測期間が短い場合は「観測中」と表示し、利用データがない場合も未使用とは断定しません。

## 技術スタック

| 領域 | 技術 |
|---|---|
| Web / API | Next.js 16（App Router / Route Handlers）、React 19、TypeScript |
| UI | Tailwind CSS v4 |
| データ | Prisma 6、PostgreSQL 15 |
| 入力検証 | Zod 4 |
| 認証 | Sign in with Apple、JWT、ローテーション式セッション、端末同期トークン |
| iOS | Swift、SwiftUI、FamilyControls、DeviceActivity、App Group |
| テスト | Vitest 4、Playwright |

## ローカルセットアップ

### 前提

- Node.js 24.x
- PostgreSQL 15

以下はDebian系の開発環境で、ローカルDBの作成から起動まで行う例です。

```bash
cd apps/web

# PostgreSQLを起動し、開発用ロールとDBを作成
bash scripts/setup-local-db.sh

# 依存関係と環境変数
npm ci
cp .env.example .env

# DBを初期化して合成データを投入
npx prisma migrate deploy
npx prisma generate
npm run db:seed

# http://localhost:3000 で起動
npm run dev
```

`SUBBUDDY_MODE=local` ではWeb画面のログインは不要です。iPhoneなどから利用量を送る場合は、`.env` の `USAGE_SYNC_TOKEN` を各自の秘密値へ変更してください。実値はコミットしません。

macOSなどでPostgreSQLを別の方法で管理する場合は、`DATABASE_URL` に接続先を設定し、DB作成後の手順から実行します。

## 主な画面

| パス | 内容 |
|---|---|
| `/` | 支出合計、見直し候補、更新間近の概況 |
| `/subscriptions` | サブスク一覧、登録、詳細、編集 |
| `/spending` | 月額・年額合計、カテゴリ別内訳、支出推移 |
| `/recommendations` | 判定別のレコメンドと観測状況 |
| `/renewals` | 更新が近い契約 |
| `/sign-in` | クラウド検証版のAppleサインイン |

## 実行モード

`SUBBUDDY_MODE` で同じコードベースの実行方法を切り替えます。

| 値 | 用途 | 認証・データ |
|---|---|---|
| `local` | 開発、個人のローカル運用 | 固定ローカルユーザー、ローカルPostgreSQL |
| `cloud-testflight` | TestFlight向け小規模検証 | Appleサインイン、ユーザー別データ、クラウドPostgreSQL |
| `production` | 将来の一般公開 | クラウド検証版と同じ認証境界を使用 |

クラウド用の環境変数は [`apps/web/.env.example`](apps/web/.env.example) を参照してください。Apple Developerやホスティング環境の実値はリポジトリに保存しません。

## iOSアプリ

`apps/ios` には、Appleサインイン、Screen Time認可、計測対象アプリの選択、DeviceActivity監視、集計値同期までを実装しています。

現時点ではサブスク一覧の取得を実装していないため、計測対象とSubBuddy上の契約を結び付ける際にサブスクIDを手入力します。XcodeGenによる生成と実機確認は [`apps/ios/README.md`](apps/ios/README.md) を参照してください。

## テスト・品質チェック

```bash
cd apps/web
npm run test
npm run lint
npm run typecheck
npm run build
```

E2Eテストはテスト用DBを用意したうえで `npm run test:e2e` を実行します。テストの実施状況は [`.audit/test-status.md`](.audit/test-status.md) が正本です。

## プロジェクト構成

```text
SubBuddy/
├── apps/
│   ├── web/             # Next.js Web/API、Prisma、テスト
│   └── ios/             # SwiftUIアプリ、DeviceActivity拡張
├── docs/                # 要求、機能設計、技術仕様、用語
├── docs/adr/            # 重要な設計判断
├── .steering/           # 作業単位の要求・設計・タスク
├── .audit/              # テスト監査台帳などの安全な証跡
├── manuals/             # 外部サービスの手動設定手順
├── research/            # 調査・戦略の記録
└── wbs/                 # 開発計画の正本とGitHub／Sheets同期ツール
```

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`docs/product-requirements.md`](docs/product-requirements.md) | プロダクト要求定義 |
| [`docs/functional-design.md`](docs/functional-design.md) | 機能、データモデル、画面、API設計 |
| [`docs/architecture.md`](docs/architecture.md) | 技術仕様、実行モード、セキュリティ方針 |
| [`docs/repository-structure.md`](docs/repository-structure.md) | ディレクトリ構成と配置ルール |
| [`docs/development-guidelines.md`](docs/development-guidelines.md) | 開発・テスト・Git規約 |
| [`docs/glossary.md`](docs/glossary.md) | ドメイン用語と命名規則 |

## PII・機微データ方針

- 開発、テスト、サンプルには合成（ダミー）データだけを使用します。
- 実行時データは選択した実行モードのPostgreSQLに保存し、リポジトリには含めません。
- `.env`、資格情報、実利用ログ、DBダンプをコミットしません。
- iPhoneから送るのは日別・サブスク単位の集計値だけです。詳細なScreen Timeログは送りません。
