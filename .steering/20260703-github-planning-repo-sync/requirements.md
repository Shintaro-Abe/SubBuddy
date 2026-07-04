# 要求内容 — 進捗・計画を非公開 planning リポジトリで管理（GitHub 同期）

> 区分: フル（`docs/` に ADR・用語を追加。新たな同期先アーキテクチャを導入）
> 正本: `wbs/wbs.yml`（main repo）。本作業は同期先に GitHub の非公開 planning repo を追加する。

## 背景・目的

現在の進捗は `wbs/wbs.yml` を正本に、差分→確認ゲート→Google スプレッドシートへ片方向同期する `/wbs-sync` で管理している。

これに「GitHub 上で、ガント（ロードマップ）とアプリ構造図を、非公開・高視認性で見る」手段を加える。
main リポジトリはパブリックのため Issue を作ると進捗が第三者に露出する。これを避けるため、進捗・図解を専用の**プライベート planning リポジトリ**へ隔離する。

## 変更・追加する機能の説明

- やること:
  - `Shintaro-Abe/SubBuddy-planning`（Private）を用意し、`wbs.yml` の各タスクを Issue として作成・更新（冪等）。`level:1`＝親 / `level:2`＝Sub-issue。
  - planning repo の Project(v2) に各 Issue を登録し、状態・フェーズ・進捗率・開始/目標日をカスタムフィールドで持たせ、ロードマップ・ビューで時間軸表示。
  - `wbs.yml` の `predecessors` から Mermaid `gantt` を生成し、planning repo の `.md` に出力（依存を含む静的ガント）。
  - アプリ構造図4点（システム構成 / データモデル ER / パターン判定 P1〜P7 フロー / 画面遷移）を planning repo にミラー。ER は `prisma/schema.prisma` から自動生成。
  - 同期は片方向（`wbs.yml` → planning repo）。手元で手動実行（新コマンド `/wbs-sync-github`）。反映前に確認ゲート。
- やらないこと:
  - GitHub 側編集を `wbs.yml` へ戻す双方向同期。
  - 依存の自動日程計算・クリティカルパス・自動スケジューリング。
  - Issue 自動クローズ / PR 連動の完了逆流。
  - GitHub Actions による自動実行（main がパブリックなためログ露出・秘密管理を避ける）。
  - エンドユーザーの実データ・PII の取り扱い（本作業は開発タスクのメタ情報のみ）。
  - Google スプレッドシート同期の即時廃止（安定後の段階廃止は別作業）。

## ユーザーストーリー

- 開発者として、`wbs.yml` を編集して同期するだけで、非公開の GitHub 上にタスク階層・ロードマップ・構造図が反映され、第三者に見られずに進捗を確認したい。
- 開発者として、ID をキーに冪等更新され、Issue が重複作成されないようにしたい。
- 開発者として、反映前に追加・更新の件数と対象を確認してから承認したい。
- 開発者として、依存関係も図（Mermaid gantt）で把握したい。

## 受け入れ条件

- [ ] AC-1: `wbs.yml` の全タスクに対応する Issue が planning repo に存在し、`level:2` は対応する `level:1` の Sub-issue になっている。
- [ ] AC-2: 再実行しても Issue が重複作成されない（Issue 本文の `<!-- wbs-id: X.Y -->` マーカーをキーに冪等更新）。
- [ ] AC-3: Project のロードマップ・ビューで、`plannedStart`/`plannedEnd` を持つタスクが時間軸上にバー表示される。
- [ ] AC-4: `status`/`phase`/`progress` が Project フィールドに反映され、絞り込み／並べ替えできる。
- [ ] AC-5: 反映前に差分（追加／更新／件数・主な対象）が提示され、承認なしに書き込みが行われない。
- [ ] AC-6: 同期は片方向で、GitHub 側を直接編集しても次回同期で `wbs.yml` に整流される。完了は Status フィールドで表現し、Issue の自動クローズは行わない。
- [ ] AC-7: 認証情報・トークン・PII がリポジトリにコミットされない（`.gitignore` 除外、非混入）。
- [ ] AC-8: 既存の Google スプレッドシート同期（`/wbs-sync`）が引き続き動作する。
- [ ] AC-9: `wbs.yml` の `predecessors` から Mermaid `gantt` が生成され、planning repo の `.md` に出力される。
- [ ] AC-10: アプリ構造図4点が planning repo にミラーされ、ER 図は `schema.prisma` から自動生成される。
- [ ] AC-11: planning repo が Private であり、進捗・図解が公開されない。

## 制約事項

- PII・機微データ方針: 実データを扱わない。planning repo に載せるのは開発タスクのメタ情報と構造図のみ。
- ローカルファースト: 同期は手元の `gh` CLI（`Shintaro-Abe`、`project` スコープ）で実行。秘密情報は repo に置かない。
- しきい値・設定の外出し: planning repo 名・Project 番号・フィールド対応は `wbs/wbs.config.yml` に外出し（非秘密）。
- 技術制約: Projects(v2) と Sub-issues は主に GraphQL API が必要（REST だけでは完結しない）。
- 既存構造の尊重: `wbs/` 配下（`diff.ts` / `sheets.ts` / `sync.ts` 等）を壊さず、GitHub アダプタとして追加する。
