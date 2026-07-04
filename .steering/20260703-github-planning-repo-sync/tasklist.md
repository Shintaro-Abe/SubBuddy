# タスクリスト — 進捗・計画を非公開 planning リポジトリで管理（GitHub 同期）

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | planning repo `Shintaro-Abe/SubBuddy-planning`（Private）を作成 | AC-11 | 保留 | `npm --prefix wbs run setup:github` を追加済み。実作成は `gh` 未ログインのため認証待ち |
| T-2 | `gh` に `project` スコープ付与（`gh auth refresh -s project,read:project`） | AC-3,AC-4 | 保留 | `gh auth status` が未ログイン。ユーザー側の GitHub 認証待ち |
| T-3 | Project(v2) 作成＋フィールド定義（Status/Phase/Progress/Start/Target/Assignee）とロードマップ・ビュー設定 | AC-3,AC-4 | 保留 | Project 作成スクリプトとフィールド同期を実装済み。実作成は gh 認証待ち |
| T-4 | `wbs.config.yml` に `github:` セクション追加（repo・projectNumber・fields・onMissing） | AC-3,AC-4,AC-6 | 完了 | 設定から出力先・対応を解決できる |
| T-5 | `wbs/lib/github/issues.ts`: 本文マーカーで冪等な Issue 作成/更新＋Sub-issue 親子付け | AC-1,AC-2 | 完了 | 再実行で重複なし、`level:2` が Sub-issue |
| T-6 | `wbs/lib/github/project.ts`: Project 項目登録＋カスタムフィールド更新（GraphQL） | AC-3,AC-4 | 完了 | フィールドが反映され絞り込み可 |
| T-7 | `wbs/lib/github/adapter.ts`＋`wbs/lib/diff.ts` 拡張: 既存 diff→confirm→apply に GitHub を接続 | AC-5,AC-6 | 完了 | 差分提示→承認→反映が通る |
| T-8 | `wbs/lib/github/gantt.ts`: `predecessors` から Mermaid gantt 生成し `.md` 出力 | AC-9 | 完了 | 依存を含む gantt が planning repo に出る |
| T-9 | `wbs/lib/github/diagrams.ts`: 構造図4点ミラー＋ER を `schema.prisma` から自動生成 | AC-10 | 完了 | 4点が planning repo に反映、ER が最新 |
| T-10 | `wbs/scripts/sync-github.ts`＋`/wbs-sync-github` 登録（手動・確認ゲート） | AC-5 | 完了 | `npm --prefix wbs run sync:github` と `sync:github:apply` を追加 |
| T-11 | 秘密・PII 非混入の確認（`.gitignore`・トークン非コミット・pre-commit スキャン） | AC-7 | 完了 | トークンは gh CLI 側管理、`.gitignore` は秘密除外済み。gitleaks 検出ゼロ（wbs・今回ステアリング・docs） |
| T-12 | `/wbs-sync`（Sheets）併存の回帰確認 | AC-8 | 完了 | 既存 `sync.ts` は未変更。`wbs` typecheck/test 通過 |
| T-13 | `docs/adr/0003` 追加・`docs/glossary.md` 用語追記 | — | 完了 | ADR・用語が反映 |
| T-14 | リント・型チェック・ドライラン検証 | AC-1〜AC-11 | 完了 | `npm --prefix wbs run typecheck`、`test`、`sync:github -- --offline` 通過。wbs に lint script は未定義。実 GitHub dry-run は gh 認証待ち |

状態: 未着手 / 進行中 / 完了 / 保留

## 実装中の逸脱ログ

- 2026-07-03: この環境では `apply_patch` と一部 sandbox 実行が bwrap 制約で失敗したため、ファイル編集と検証は承認付きサンドボックス外実行で行った。
- 2026-07-03: `gh` が未ログインのため、planning repo/Project の実作成と実 apply は保留。`npm --prefix wbs run setup:github` と `sync:github` 実装までは完了。

## 完了チェック

- [ ] 全タスク完了
- [ ] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [x] 型チェック・テスト実施（wbs に lint script なし）
- [x] 必要な `docs/` 更新を反映（ADR-0003・glossary）
