# リポジトリ構造定義書（Repository Structure）

> プロジェクト名 / アプリ名：**SubBuddy**
> ドキュメント種別：永続的ドキュメント（`docs/`）
> 最終更新：2026-06-02
> 関連：`product-requirements.md`（要求）、`functional-design.md`（機能設計）、`architecture.md`（技術仕様）、`development-guidelines.md`（開発規約）、`glossary.md`（用語）

---

## 1. 本書の位置づけ

本書は SubBuddy のリポジトリにおける **フォルダ・ファイル構成、各ディレクトリの役割、ファイル配置ルール** を定義する。
`architecture.md` の技術スタック（Next.js App Router／Prisma＋PostgreSQL／Zod／Vitest／iOS Swift）と、
`CLAUDE.md` のドキュメント運用（`docs/` 永続・`.steering/` 作業単位）に整合させる。

設計上の前提（`architecture.md` から継承）：

- **Mac 側（Next.js）と iPhone 側（Swift）の 2 コードベース**を 1 リポジトリに同居（`apps/` 配下に分離）。
- **利用量取り込みはソース別コネクタ（Adapter）で一元化**（`architecture.md` §5.1）。配置場所を本書で固定する。
- **ドメインロジックは API/Web から独立**（Worker 分離の可搬性。`architecture.md` §7）。
- **PII・秘密情報はコミットしない**。合成データのみをリポジトリに置く（`CLAUDE.md` 準拠）。

> **MVP は薄く始める**：本書のツリーは到達目標の構造を示す。MVP では未使用のディレクトリを先回りで作らず、必要になった時点で追加する（`architecture.md` §5.1「rule of three」）。空ディレクトリは作らない。

---

## 2. トップレベル構成

```
SubBuddy/
├── CLAUDE.md                  # プロジェクトメモリ（開発標準ルール）
├── README.md                  # 概要・セットアップ手順
├── .gitignore                 # 実データ・秘密情報・ビルド成果物を除外
├── .editorconfig              # エディタ共通設定
├── docs/                      # 永続的ドキュメント（北極星）
├── .steering/                 # 作業単位ドキュメント（[YYYYMMDD]-[タイトル]/）
└── apps/
    ├── web/                   # Mac 側：Next.js（Web + API + Worker 同居）
    └── ios/                   # iPhone 側：Swift / SwiftUI（利用量センサー）
```

- **`apps/` で Mac 側と iPhone 側を物理分離**する。両者は言語・ツールチェーンが異なるため、依存とビルドを混在させない。
- ルート直下には**設定・ドキュメント・アプリ群のみ**を置き、実装コードは各 `apps/*` に閉じ込める。
- パッケージ共有機構（`packages/` 等のモノレポ化）は **MVP では導入しない**。必要が生じた時点で別途検討する（過剰構造の回避）。

---

## 3. ドキュメント構成（`docs/` / `.steering/`）

`CLAUDE.md` の分類に従う。

```
docs/                                  # 永続的ドキュメント（基本設計が変わらない限り更新しない）
├── product-requirements.md            # プロダクト要求定義書
├── functional-design.md               # 機能設計書（データモデル・ER 図・画面遷移）
├── architecture.md                    # 技術仕様書（本構造の一次情報）
├── repository-structure.md            # 本書
├── development-guidelines.md          # 開発ガイドライン（規約）
├── glossary.md                        # ユビキタス言語定義
└── images/                            # （任意）複雑な図のみ。PNG/SVG。Mermaid 優先で原則不要

.steering/                             # 作業単位ドキュメント
└── [YYYYMMDD]-[開発タイトル]/
    ├── requirements.md                # 今回の要求
    ├── design.md                      # 今回の設計
    └── tasklist.md                    # タスクと進捗
```

- 図表は独立フォルダを作らず、**関連する永続ドキュメント内に Mermaid で直接記載**する（`CLAUDE.md` 図表ルール）。
- `.steering/` のディレクトリは作業ごとに新規作成し、完了後も履歴として保持する（削除しない）。

---

## 4. Mac 側：`apps/web/`（Next.js）

```
apps/web/
├── package.json
├── .tool-versions                 # Node 等のバージョン一次情報（architecture では固定しない）
├── .env.example                   # 環境変数のテンプレ（値はダミー）。実 .env はコミットしない
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── eslint.config.mjs
├── vitest.config.ts
├── prisma/
│   ├── schema.prisma              # DB スキーマの単一ソース（functional-design §5）
│   ├── migrations/                # マイグレーション履歴
│   └── seed.ts                    # 合成データのみ（実 PII 禁止）
├── public/                        # 静的アセット
└── src/
    ├── app/                       # App Router（画面 + Route Handlers）
    │   ├── (dashboard)/           # Web ダッシュボード画面群
    │   └── api/                   # Route Handlers（/api/*）
    ├── domain/                    # ★ドメインロジック（UI/API 非依存・Worker へ分離可能）
    │   ├── scoring/               # ルールベース判定（functional-design §8）
    │   └── usage/                 # 利用量の集計・正規化ロジック
    ├── ingestion/                 # ★利用量・請求の取り込み（architecture §5.1）
    │   ├── connectors/            # ソース別コネクタ（Adapter）
    │   │   ├── screen-time/       # 利用時間（iPhone 集計値）
    │   │   ├── icloud/            # 容量
    │   │   ├── gym-visit/         # 来館（位置情報ベース・採用時）
    │   │   └── billing-email/     # 請求メール抽出（フェーズ2）
    │   └── normalize/             # 共通モデルへの（遅延）正規化
    ├── repositories/              # Prisma 経由の永続化（ドメインから DB を隠蔽）
    ├── config/                    # スコアリング閾値等の外出し設定（Zod 検証。architecture §6）
    ├── schemas/                   # Zod スキーマ（API 入力・取り込みペイロード）
    ├── lib/                       # 横断ユーティリティ（型・通貨・日付等）
    └── components/                # UI コンポーネント（React + Tailwind）
└── tests/                         # Vitest（domain 中心の単体テスト）。合成データのみ
```

### 4.1 配置ルール（Mac 側）

- **ドメインロジックは `src/domain/` に集約**し、`app/api/` や `components/` にビジネスルールを散在させない（`architecture.md` §7 の分離点を守る）。
- **取り込みは `src/ingestion/` に閉じる**。新しい取得源は `connectors/<source>/` を 1 つ追加するだけで対応する（コア無改修）。
  - コネクタは**取得した原本（生データ）を保持**し、共通モデルへの正規化は `normalize/` で遅延実行（入口で情報を捨てない。`architecture.md` §5.1）。
- **DB アクセスは `src/repositories/` 経由のみ**。ドメイン層から Prisma を直接呼ばない（Worker 分離・テスト容易性のため）。
- **スコアリング閾値はコード直書きせず `src/config/` に外出し**（Zod 検証。`architecture.md` §6）。
- **Zod スキーマは `src/schemas/` に集約**し、API 入力・取り込みペイロードの検証境界を一元化する。
- `prisma/seed.ts` と `tests/` は**合成データのみ**。実 PII・実ファイルを使わない。

---

## 5. iPhone 側：`apps/ios/`（Swift / SwiftUI）

```
apps/ios/
├── SubBuddy.xcodeproj/            # （または Package.swift）
├── SubBuddy/                      # アプリ本体
│   ├── App/                       # エントリ・画面（SwiftUI）
│   ├── Models/                    # SwiftData モデル（オンデバイス集計の保持）
│   ├── Usage/                     # DeviceActivity / FamilyControls まわり
│   ├── Location/                  # （採用時）ジオフェンス・来館検出
│   └── Sync/                      # Mac API への集計値送信（URLSession / HTTPS）
└── DeviceActivityMonitorExtension/ # しきい値超過イベント受信 Extension
```

### 5.1 配置ルール（iPhone 側）

- iPhone から Mac へ送るのは **集計値のみ**（詳細ログ・生の位置情報は送らない。`product-requirements.md` 非機能要件 / `architecture.md` §3.2）。
- entitlement・署名情報・プロビジョニングプロファイル等の**秘密情報はコミットしない**（`.gitignore` で除外）。

---

## 6. ファイル配置の基本ルール（横断）

| 対象 | 置き場所 | 備考 |
|---|---|---|
| 永続ドキュメント | `docs/` | 基本設計の変更時のみ更新 |
| 作業単位ドキュメント | `.steering/[YYYYMMDD]-[タイトル]/` | 作業ごとに新規・履歴保持 |
| Mac 実装 | `apps/web/src/` | レイヤ別（domain / ingestion / repositories / config / schemas / components） |
| iOS 実装 | `apps/ios/` | センサー・同期のみ。判定ロジックは持たせない |
| DB スキーマ | `apps/web/prisma/schema.prisma` | 単一ソース |
| 設定値（閾値等） | `apps/web/src/config/` | Zod 検証・外出し |
| 合成データ | `prisma/seed.ts` / `tests/` | 実 PII 禁止 |
| 図・ダイアグラム | 関連 `docs/*.md` 内 Mermaid | 独立フォルダを作らない |

### 除外（コミットしない）— `.gitignore` で担保

- `.env`・各種資格情報・トークン（`.env.example` のみ追跡）
- 本番 DB ダンプ・実データファイル・実 PII を含むスクショ
- ビルド成果物（`node_modules/`、`.next/`、`build/`、Xcode `DerivedData/` 等）
- iOS 署名・プロビジョニング関連の秘密情報

> **重要**：実在の個人データ・秘密情報は**読み取らない／生成しない／コミットしない**（`CLAUDE.md` PII 方針）。やむを得ず触れる必要が生じた場合は作業を止めて確認する。

---

## 7. 命名規則（ディレクトリ／ファイルの粒度）

詳細なコード命名規則は `development-guidelines.md` に定義する。本書ではリポジトリ構造に関わる粒度のみ規定する。

- **ディレクトリ**：ケバブケース（例：`gym-visit/`、`billing-email/`）。役割が一目で分かる名前にする。
- **コネクタ名は取得源を表す**（`screen-time`／`icloud`／`gym-visit`／`billing-email`）。共通モデルの軸名（time/capacity/visit）と混同しない。
- **ステアリングディレクトリ**：`[YYYYMMDD]-[開発タイトル]`（`CLAUDE.md` 命名規則に従う）。
- TypeScript / Swift それぞれのファイル命名は `development-guidelines.md` を一次情報とする。
