# レビューパック — 進捗・計画を非公開 planning リポジトリで管理（GitHub 同期）

> このファイル1枚で requirements / design / tasklist をまとめて承認する。

## 区分

- [ ] 軽量
- [x] フル（`docs/` に ADR・用語を追加。新たな同期先アーキテクチャを導入。第二意見必須）

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 | issues.ts（Sub-issue 親子） | T-5 | 対応 |
| AC-2 | issues.ts（本文マーカー冪等） | T-5 | 対応 |
| AC-3 | wbs.config.yml github・project.ts・ロードマップ | T-3,T-4,T-6 | 対応 |
| AC-4 | project.ts・フィールド対応 | T-3,T-4,T-6 | 対応 |
| AC-5 | adapter.ts・diff.ts・sync-github.ts | T-7,T-10 | 対応 |
| AC-6 | adapter.ts（片方向整流）・Status 表現 | T-4,T-7 | 対応 |
| AC-7 | .gitignore・pre-commit スキャン | T-11 | 対応 |
| AC-8 | Sheets 併存の回帰 | T-12 | 対応 |
| AC-9 | gantt.ts | T-8 | 対応 |
| AC-10 | diagrams.ts（ER 自動生成） | T-9 | 対応 |
| AC-11 | planning repo Private 作成 | T-1 | 対応 |

> 漏れ・孤立の有無: なし（全 AC にタスクが対応。T-13/T-14 は docs 反映・検証の横断タスク）。

## 前提・未決事項

### 要ユーザー判断（承認前に解消）

- [x] Q-1: 軸は GitHub、非公開の専用 planning repo に集約 → 決定済み。
- [x] Q-2: 正本は `wbs.yml`、片方向、GitHub は閲覧用 → 決定済み。
- [x] Q-3: ガントは Projects ロードマップ＋Mermaid gantt 併用 → 決定済み。
- [x] Q-4: 構造図4点、正本は公開 docs＋planning repo にミラー → 決定済み。
- [x] Q-5: Sheets は安定まで併存→段階廃止 → 決定済み。
- [x] Q-6: 手動実行（Actions なし）、冪等キーは本文マーカー、バーは予定日、完了は Status（自動クローズなし） → 決定済み。

未決事項: なし。

### 設計上の前提（崩れると設計が変わるもの）

- planning repo は Private（露出回避が目的）。
- `gh` に `project` スコープ付与済み。
- 構造図の正本は公開 `docs/*.md` の Mermaid（公開 docs は残す）。
- PII・秘密は非混入（開発メタ情報と構造図のみ）。

## 影響範囲

- `docs/` への影響 / 更新案: ADR-0003 追加、`glossary.md` に「計画リポジトリ」「片方向整流」追記。
- 既存コード・機能への影響: `/wbs-sync`（Sheets）は不変。`wbs/lib/diff.ts` を後方互換で拡張。
- マイグレーション・後方互換: `wbs.config.yml` に `github:` 無しなら GitHub 同期はスキップ。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| セキュリティ/プライバシー | パブリック main への露出 | planning repo を Private 化・トークン非コミット・PII 非混入 |
| アーキ | 同期先が増え運用二重化 | Sheets は安定後に段階廃止し GitHub 一本化 |
| QA | 冪等性の担保 | 本文マーカー `<!-- wbs-id -->` をキーに、再実行で重複なしを検証（T-14） |
| PM | 図とコードの乖離 | ER は `schema.prisma` から自動生成、構造図はミラーで手動二重管理を排除 |

### 第二意見（フル区分は必須）

- 手段: grilling（本セッションで設計ツリーを一問一答で反証・確定）
- 要点: プラットフォーム選定→非公開担保→正本→ガント精度→図の正本→Sheets 去就→自動化→冪等キー→フィールド/完了→repo/認証 の順で論点を潰した。
- 反映した内容: パブリック露出回避のための専用 Private repo、依存表示のための Mermaid gantt 併用、自動クローズ無し等を設計へ反映。

## 承認

- [x] 未決事項ゼロを確認
- [x] トレーサビリティ表に漏れ・孤立なし
- [x] 上記をもって requirements / design / tasklist をまとめて承認（2026-07-03 ユーザー承認）
