# タスクリスト — 進捗・計画を非公開 planning リポジトリで管理（GitHub 同期）

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | planning repo `Shintaro-Abe/SubBuddy-planning`（Private）を作成 | AC-11 | 完了 | `setup:github` で repo exists を確認済み |
| T-2 | `gh` に `project` スコープ付与（`gh auth refresh -s project,read:project`） | AC-3,AC-4 | 完了 | `setup:github` が Project 作成まで成功 |
| T-3 | Project(v2) 作成＋フィールド定義（WBS Status/Phase/Progress/Start/Target/Task Assignee）とロードマップ・ビュー設定 | AC-3,AC-4 | 保留 | Project #1 に 100項目と各フィールド反映済み。GitHub API で Roadmap view 作成 mutation は確認できず、ビュー作成は手動設定待ち |
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
| T-15 | GitHub GraphQL owner 判定バグ修正 | AC-3,AC-4 | 完了 | `user` と `organization` を同一 query で取得せず、owner 種別を単独照会してから Project を読む |
| T-16 | GitHub secondary rate limit 対策 | AC-1,AC-5 | 完了 | GitHub 書き込みに既定 2 秒待機を追加し、`--max-issue-writes=N` で Issue の分割反映を可能にした |
| T-17 | GitHub GraphQL `data` ラッパー処理修正 | AC-3,AC-4 | 完了 | `gh api graphql` の `{ data: ... }` を unwrap し、owner ID を正しく読めるようにした |

状態: 未着手 / 進行中 / 完了 / 保留

## 実装中の逸脱ログ

- 2026-07-03: この環境では `apply_patch` と一部 sandbox 実行が bwrap 制約で失敗したため、ファイル編集と検証は承認付きサンドボックス外実行で行った。
- 2026-07-03: `gh` が未ログインのため、planning repo/Project の実作成と実 apply は保留。`npm --prefix wbs run setup:github` と `sync:github` 実装までは完了。
- 2026-07-04: `setup:github` の owner 判定バグを修正。`typecheck`、`test`、`sync:github -- --offline` は通過。実 GitHub setup は現環境の `gh` 未ログインで保留。
- 2026-07-04: ユーザー実行の `sync:github:apply` が GitHub secondary rate limit（Issue 作成の短時間連続実行）で停止。再試行連打を避けるため、書き込み待機と Issue 分割反映オプションを追加した。
- 2026-07-04: `gh api graphql` の戻り値が `{ data: ... }` で包まれている点を見落としていたため、owner ID 取得が空扱いになっていた。`ghGraphql` で `data` を unwrap するよう修正し、`setup:github` が Project #1 作成まで成功した。
- 2026-07-04: `sync:github:apply -- --max-issue-writes=20` で残り 20 件の Issue 作成が成功。直後の dry-run で `追加 0 / 変更なし 100` を確認した。Sub-issue / Project / 生成ファイル同期は次の通常 apply 待ち。
- 2026-07-04: 通常 apply 中に GitHub Project の `Assignee` カスタムフィールド作成が予約名衝突で失敗。WBS 側の `assignee` は維持し、Project 表示名だけ `Task Assignee` に変更した。
- 2026-07-04: GitHub 既定 `Status` は `Todo / In Progress / Done` のため、WBS の `未着手 / 進行中 / 完了 / 保留` をそのまま反映できない。Project 表示名を `WBS Status` に変更した。
- 2026-07-04: 通常 apply が完了。Project #1 は 100項目、`WBS Status` / `Phase` / `Progress` / `Start` / `Target` / `Task Assignee` を確認済み。`roadmap/gantt.md` も planning repo 反映済み。Project view は既定の `View 1`（Table）のみで、Roadmap view 作成は GitHub UI 手動設定が必要。
- 2026-07-04: ユーザー要望を受けて Codex 側で再確認。GitHub GraphQL schema の mutation 一覧に `createProjectV2View` / `updateProjectV2View` 相当は無く、Project view は `View 1`（`TABLE_LAYOUT`）のみ。Roadmap layout への切替は GitHub UI 操作が必要。

## 完了チェック

- [ ] 全タスク完了
- [ ] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [x] 型チェック・テスト実施（wbs に lint script なし）
- [x] 必要な `docs/` 更新を反映（ADR-0003・glossary）
