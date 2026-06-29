# SubBuddy

サブスクリプションの「継続／様子見／解約」を**パターン判定方式**で提案する、ローカルファーストの個人向け管理アプリ。

具体的な根拠（未利用・重複・安いプラン・安い競合・更新間近・高額長期）に基づいて見直すべき契約を判定し、後悔しない判断を支援します。

## パターン判定（P1〜P7）

| パターン | 状況 | レコメンド |
|---|---|---|
| P1 | 使っていない | 解約検討 |
| P2 | 同カテゴリに複数あり割高 | 解約検討 |
| P3 | 同サービスに安い有料プランがある | ダウングレード検討 |
| P4 | 同カテゴリに安い有料競合がある | 乗り換え検討 |
| P5 | 年額更新が近い | 更新前に見直し |
| P6 | 高額で長期継続 | 確認 |
| P7 | 該当なし | 継続 |

P1 はサブスクの利用の性質（`usage_type`）に応じて適用を切り替えます。受動利用（クラウドストレージ等）や権利保有（Amazon Prime等）には「使っていないから解約」という誤ったレコメンドを出しません。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Web | Next.js 16（App Router）/ React 19 / TypeScript（strict）/ Tailwind CSS v4 |
| データ | Prisma 6 / PostgreSQL 15 |
| 検証 | Zod 4 / Vitest 4 / Playwright |
| 利用記録 | iOS Shortcuts → HTTP POST（iOS アプリ不要） |
| 知識ベース | サービスカタログ 50件（JSON / Seed）/ あいまい検索（Fuse.js） |

## 前提

- Node.js 24.x
- PostgreSQL 15

## セットアップ

```bash
# 依存関係
cd apps/web
npm install

# DB
npx prisma migrate dev
npx prisma db seed

# 起動
npm run dev
```

## プロジェクト構成

```
SubBuddy/
├── apps/web/                # Web アプリ（Next.js）
│   ├── src/
│   │   ├── domain/scoring/  # パターン判定エンジン（P1〜P7）
│   │   ├── domain/usage/    # 利用量データの集計・正規化
│   │   ├── config/          # しきい値の外出し（scoring.ts）
│   │   └── components/      # UI コンポーネント
│   ├── prisma/
│   │   ├── schema.prisma    # データモデル
│   │   └── seed/            # サービスカタログ（50件）
│   └── e2e/                 # E2E テスト（Playwright）
├── docs/                    # 永続的ドキュメント（設計・要求・用語）
├── .steering/               # 作業単位のステアリングファイル
├── research/                # 調査・戦略の記録
└── wbs/                     # WBS 同期ツール（Google Sheets 連携）
```

## ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/product-requirements.md` | プロダクト要求定義 |
| `docs/functional-design.md` | 機能設計（判定ルール・画面設計） |
| `docs/architecture.md` | 技術仕様 |
| `docs/glossary.md` | 用語定義（パターン判定・usage_type 含む） |
| `docs/repository-structure.md` | ディレクトリ構成 |
| `docs/development-guidelines.md` | 開発ガイドライン |

## PII・機微データ方針

- 開発・テスト・サンプルには**合成（ダミー）データのみ**を使用
- 実データは実行時にローカル DB にのみ保存
- `.env`・資格情報・実利用ログはコミットしない
- iPhone から受け取るのは「サブスクID＋日付＋起動した事実」のみ
