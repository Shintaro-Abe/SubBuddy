# リポジトリ構造定義書（Repository Structure）

> プロジェクト名 / アプリ名：**SubBuddy**
> ドキュメント種別：永続的ドキュメント（`docs/`）
> 最終更新：2026-07-21（案内進捗、Web設定、iPhone自動同期、手順書管理を反映）
> 関連：`product-requirements.md`（要求）、`functional-design.md`（機能設計）、`architecture.md`（技術仕様）、`development-guidelines.md`（開発規約）、`glossary.md`（用語）

---

## 1. 本書の位置づけ

本書は SubBuddy のリポジトリにおける **フォルダ・ファイル構成、各ディレクトリの役割、ファイル配置ルール** を定義する。
`architecture.md` の技術スタック（Next.js App Router／Prisma＋PostgreSQL／Zod／Vitest／iOS Swift）と、
`AGENTS.md` のドキュメント運用（`docs/` 永続・`.steering/` 作業単位）に整合させる。

設計上の前提（`architecture.md` から継承）：

- **Web/API 側（Next.js）と iPhone 側（Swift）の 2 コードベース**を 1 リポジトリに同居（`apps/` 配下に分離）。両方とも実装が存在する。
- **取得源ごとに入力検証とデータ最小化の境界を置く**（`architecture.md` §5.2）。汎用コネクタ基盤は共通点が複数現れてから追加する。
- **ドメインロジックは API/Web から独立**（Worker 分離の可搬性。`architecture.md` §7）。
- **PII・秘密情報はコミットしない**。合成データのみをリポジトリに置く（`AGENTS.md` 準拠）。

> **MVP は薄く始める**：本書のツリーは到達目標の構造を示す。MVP では未使用のディレクトリを先回りで作らず、必要になった時点で追加する（`architecture.md` §5.2「rule of three」）。空ディレクトリは作らない。

---

## 2. トップレベル構成

```
SubBuddy/
├── AGENTS.md                  # プロジェクト指示（Codex CLI 用。主要な作業ルールとメモリ索引）
├── README.md                  # 概要・セットアップ手順
├── .gitignore                 # 実データ・秘密情報・ビルド成果物等を除外
├── .editorconfig              # エディタ共通設定
├── docs/                      # 永続的ドキュメント（北極星）
├── .steering/                 # 作業単位ドキュメント（[YYYYMMDD]-[タイトル]/）
├── obsidian/                  # 日付付き技術メモ。現行仕様の正本ではない
├── .agents/skills/            # リポジトリ管理の Codex Skills（SKILL.md 標準）
├── .codex/                    # Codex ハーネス（config.toml / agents/*.toml / hooks/ / harness/）
├── memory/                    # 旧自動メモリ（Codex は自動注入なし→明示 read。集約時に配置）
├── manuals/                   # ローカル専用の人手操作手順書（Git非追跡）
├── wbs/                       # WBS 進捗管理の正本（wbs.yml）と Sheets 同期ツール
├── secrets/                   # SA 鍵等の秘密情報の置き場（.gitkeep のみ追跡。鍵はコミットしない）
├── migration/                 # Codex 移行の中継コピー集約先（.gitignore 除外。コミットしない）
└── apps/
    ├── web/                   # Web/API 側：Next.js（Web + API + スコアリング同居）
    └── ios/                   # iPhone 側：SwiftUI本体 + DeviceActivity Monitor Extension
```

- **エージェント環境**：`AGENTS.md`、`.agents/skills/`、`.codex/` を Codex 用の作業基盤とする。構成の詳細は `.codex/harness/harness-map.md`。
- **`apps/` で Web/API 側と iPhone 側を物理分離**する。両者は言語・ツールチェーンが異なるため、依存とビルドを混在させない。
- ルート直下には**設定・ドキュメント・アプリ群のみ**を置き、実装コードは各 `apps/*` に閉じ込める。
- パッケージ共有機構（`packages/` 等のモノレポ化）は **MVP では導入しない**。必要が生じた時点で別途検討する（過剰構造の回避）。

---

## 3. ドキュメント構成（`docs/` / `.steering/`）

`AGENTS.md` の分類に従う。

```
docs/                                  # 永続的ドキュメント（基本設計が変わらない限り更新しない）
├── product-requirements.md            # プロダクト要求定義書
├── functional-design.md               # 機能設計書（データモデル・ER 図・画面遷移）
├── architecture.md                    # 技術仕様書（本構造の一次情報）
├── repository-structure.md            # 本書
├── development-guidelines.md          # 開発ガイドライン（規約）
├── glossary.md                        # ユビキタス言語定義
├── adr/                               # Architecture Decision Record（重要な設計判断）
└── images/                            # （任意）複雑な図のみ。PNG/SVG。Mermaid 優先で原則不要

.steering/                             # 作業単位ドキュメント
└── [YYYYMMDD]-[開発タイトル]/
    ├── requirements.md                # 今回の要求
    ├── design.md                      # 今回の設計
    ├── tasklist.md                    # タスクと進捗
    └── review-pack.md                 # まとめ承認用パック（区分・トレーサビリティ・未決事項・レビュー）
```

- 図表は独立フォルダを作らず、**関連する永続ドキュメント内に Mermaid で直接記載**する（`AGENTS.md` 図表ルール）。
- `.steering/` のディレクトリは作業ごとに新規作成し、完了後も履歴として保持する（削除しない）。

---

## 4. Web/API 側：`apps/web/`（Next.js）

```
apps/web/
├── package.json
├── .tool-versions                 # Node 等のバージョン一次情報（architecture では固定しない）
├── .env.example                   # 環境変数のテンプレ（値はダミー）。実 .env はコミットしない
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs            # Tailwind CSS v4のPostCSS設定
├── eslint.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── prisma/
│   ├── schema.prisma              # DB スキーマの単一ソース（functional-design §5）
│   ├── migrations/                # マイグレーション履歴
│   ├── seed.ts                    # ローカル開発用の合成データ（実 PII 禁止）
│   └── bootstrap-service-catalog.ts # 利用者データに触れないカタログ同期
├── public/                        # 静的アセット
└── src/
    ├── app/                       # App Router（画面 + Route Handlers）
    │   ├── (dashboard)/           # ダッシュボード、契約、支出、見直し、更新、使い方、設定
    │   └── api/                   # Route Handlers（/api/*）
    ├── domain/                    # ★ドメインロジック（UI/API 非依存・Worker へ分離可能）
    │   ├── scoring/               # パターンマッチング判定・判定根拠(matchedPatterns)（functional-design §8）
    │   ├── spending/              # 支出集計（月額/年額合計・カテゴリ別内訳・月次推移。F-12）
    │   └── usage/                 # 利用量データの集計・正規化（判定の入力準備）
    ├── services/                  # ★アプリケーションサービス（認証、案内進捗、再計算等）
    ├── repositories/              # Prisma 経由の永続化（ドメインから DB を隠蔽）
    ├── config/                    # スコアリング閾値等の外出し設定（Zod 検証。architecture §6）
    ├── schemas/                   # Zod スキーマ（API 入力・取り込みペイロード）
    ├── lib/                       # 横断ユーティリティ（型・通貨・日付等）
    └── components/                # UI コンポーネント（React + Tailwind）
├── tests/                         # 横断的なVitestテスト。合成データのみ
└── e2e/                           # Playwright E2E。合成データのみ
```

### 4.1 配置ルール（Web/API 側）

- **ドメインロジックは `src/domain/` に集約**し、`app/api/` や `components/` にビジネスルールを散在させない（`architecture.md` §7 の分離点を守る）。
- **アプリケーションサービスは `src/services/` に配置**。ドメインロジックとリポジトリを組み合わせたユースケース実行（レコメンド再計算等）を担い、Worker 分離の単位となる。
- **DB アクセスは `src/repositories/` 経由のみ**。ドメイン層から Prisma を直接呼ばない（Worker 分離・テスト容易性のため）。
- **スコアリング閾値はコード直書きせず `src/config/` に外出し**（Zod 検証。`architecture.md` §6）。
- **Zod スキーマは `src/schemas/` に集約**し、API 入力・取り込みペイロードの検証境界を一元化する。
- `prisma/seed.ts` とテストは**合成データのみ**。クラウドのカタログ同期には、利用者・契約へ触れない`bootstrap-service-catalog.ts`を使い、開発用seedを使わない。

---

## 5. iPhone 側：`apps/ios/`（Swift / SwiftUI）

```
apps/ios/
├── project.yml                    # XcodeGenのプロジェクト定義
├── SubBuddyApp/
│   ├── App/                       # SwiftUI画面、デザイン、APIモデル、認証、計測、同期、Keychain
│   ├── Shared/                    # App Group共有の対応表・集計レコード
│   ├── Resources/                 # 同梱フォントとOFLライセンス
│   └── Assets.xcassets/           # アプリアイコン等
├── SubBuddyMonitorExtension/      # しきい値超過イベント受信Extension
├── SubBuddyAppTests/              # 共有処理・UIモデル・表示整形のXCTest
└── scripts/                       # XcodeGen・Simulator build・単体テストの検証スクリプト
```

### 5.1 配置ルール（iPhone 側）

- iPhone から SubBuddy API へ送るのは **集計値のみ**（詳細ログ・生の位置情報は送らない。`product-requirements.md` 非機能要件 / `architecture.md` §3.2）。
- Web版と共通利用するフォントは`SubBuddyApp/Resources/Fonts/`、配布条件を示すライセンスは`SubBuddyApp/Resources/FontLicenses/`へ置き、`project.yml`のresourcesと`UIAppFonts`へ登録する。
- iOSの更新トークン、セッションID、デバイス同期トークン、端末内生成IDはKeychainに置く。利用量集計と計測対象対応表はApp Group内のファイルへ置き、紐付け解除・契約削除時は対象の未送信利用記録も同時に削除する。
- `project.yml`を正本としてXcodeGenで`.xcodeproj`を生成する。生成物を正本にしない。
- SwiftUIはルート状態、3タブ、機能別View、ViewModel相当の`ProductStore`、API/表示モデル、案内進捗、自動同期、デザイントークンを`SubBuddyApp/App/`内で分離する。合成プレビューは`PreviewFixtures.swift`へ置く。
- 主要操作色、塗りつぶしボタン、Apple公式ボタン寸法は`DesignSystem.swift`の共通定義を使い、画面ごとにライト・ダーク配色を直書きしない。
- 利用者向けUIの基本回帰は`apps/ios/scripts/verify-main-ui.sh`でXcodeGen、Simulator build、単体テストを一続きで実行する。利用可能なiPhone Simulatorは自動選択する。
- entitlement・署名情報・プロビジョニングプロファイル等の**秘密情報はコミットしない**（`.gitignore` で除外）。

---

## 6. WBS進捗管理とローカル手順：`wbs/` / `manuals/` / `secrets/`

開発タスクの進捗を WBS で管理する。**正本（Source of Truth）はリポジトリの `wbs/wbs.yml`** で、Google スプレッドシートは人間向けの生成ビュー（片方向同期：spec → Sheets）。運用フロー（自動トリガ＋確認ゲート）は `development-guidelines.md` を一次情報とする。

```
wbs/
├── wbs.yml                       # ★WBS 正本（1タスク=1エントリ。WBS ID は不変）
├── wbs.config.yml                # 非秘密の設定（spreadsheetId・シート名・列順・onMissing 方針）
├── .env.example                  # 認証情報のテンプレ（ダミー）。実 .env はコミットしない
├── lib/                          # 純粋ロジック（types / serialize / diff / config / spec / env / sheets）
└── scripts/                      # 実行スクリプト（init-sheets / sync / detect-bolt-complete.mjs）

manuals/
├── README.md                     # ローカル操作手順の置き場の方針
└── *.md / *.html                 # MDを正とし、HTMLはMDから生成

secrets/
└── .gitkeep                      # 鍵置き場のプレースホルダ（鍵本体は .gitignore で除外）
```

### 6.1 配置ルール（WBS）

- **正本は `wbs/wbs.yml` のみ**。スプレッドシートは生成物であり、人手で直接編集しても次回同期で正本に上書きされる。
- `wbs.yml` には**開発タスクのメタ情報のみ**を書く。エンドユーザーの PII・機微データを記載しない（`AGENTS.md` PII 方針）。
- **秘密情報は `wbs.config.yml` に書かない**。SA 鍵パスは `wbs/.env`（gitignore）で `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` として指定し、鍵本体は `secrets/` に置く。
- **`secrets/` 配下の鍵は絶対にコミットしない**（`.gitignore` で除外、`.gitleaks.toml` の allowlist 対象）。`.gitkeep` のみ追跡する。
- `manuals/`は手作業の正本Markdownと生成HTMLを置く。原則はローカル運用だが、複数環境で共有する必要がある一般化済み手順は個別に追跡してよい。追跡状態にかかわらず、実在の鍵・トークン・接続情報・個人識別子は記載しない。

---

## 7. ファイル配置の基本ルール（横断）

| 対象 | 置き場所 | 備考 |
|---|---|---|
| 永続ドキュメント | `docs/` | 基本設計の変更時のみ更新 |
| 作業単位ドキュメント | `.steering/[YYYYMMDD]-[タイトル]/` | 作業ごとに新規・履歴保持 |
| Web/API 実装 | `apps/web/src/` | レイヤ別（domain / services / repositories / config / schemas / components） |
| iOS 実装 | `apps/ios/` | 主製品UI、認証、計測、同期、端末内保存。見直し計算はサーバー側に置く |
| DB スキーマ | `apps/web/prisma/schema.prisma` | 単一ソース |
| 設定値（閾値等） | `apps/web/src/config/` | Zod 検証・外出し |
| 合成データ | `prisma/seed.ts` / `tests/` | 実 PII 禁止 |
| WBS 正本 | `wbs/wbs.yml` | 進捗の単一ソース。Sheets は生成ビュー |
| WBS 同期設定（非秘密） | `wbs/wbs.config.yml` | spreadsheetId・列順等。秘密は書かない |
| 人手の操作手順 | `manuals/` | Markdownを正本、HTMLを生成物とする。一般化済み手順だけ個別に追跡可 |
| SA 鍵等の秘密 | `secrets/`（gitignore） | `.gitkeep` のみ追跡。鍵はコミットしない |
| 図・ダイアグラム | 関連 `docs/*.md` 内 Mermaid | 独立フォルダを作らない |

### 除外（コミットしない）— `.gitignore` で担保

- `.env`・各種資格情報・トークン（`.env.example` のみ追跡）。`wbs/.env`・`secrets/` の SA 鍵も対象
- 本番 DB ダンプ・実データファイル・実 PII を含むスクショ
- ビルド成果物（`node_modules/`、`.next/`、`build/`、Xcode `DerivedData/` 等）
- iOS 署名・プロビジョニング関連の秘密情報

> **重要**：実在の個人データ・秘密情報は**読み取らない／生成しない／コミットしない**（`AGENTS.md` PII 方針）。やむを得ず触れる必要が生じた場合は作業を止めて確認する。

---

## 8. 命名規則（ディレクトリ／ファイルの粒度）

詳細なコード命名規則は `development-guidelines.md` に定義する。本書ではリポジトリ構造に関わる粒度のみ規定する。

- **ディレクトリ**：ケバブケース（例：`gym-visit/`、`billing-email/`）。役割が一目で分かる名前にする。
- **コネクタ名は取得源を表す**（`screen-time`／`icloud`／`gym-visit`／`billing-email`）。共通モデルの軸名（time/capacity/visit）と混同しない。
- **ステアリングディレクトリ**：`[YYYYMMDD]-[開発タイトル]`（`AGENTS.md` 命名規則に従う）。
- TypeScript / Swift それぞれのファイル命名は `development-guidelines.md` を一次情報とする。
