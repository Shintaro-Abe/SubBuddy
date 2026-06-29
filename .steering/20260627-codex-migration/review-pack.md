# レビューパック — Codex CLI 開発環境への移行

> このファイル1枚で、3ドキュメントをまとめて承認する。

## 区分

- [ ] 軽量（バグ修正・小改修。基本設計に触れない）
- [x] フル（新機能・`docs/` に触れる変更。第二意見必須）

ハーネス（基本設計）と `docs/repository-structure.md` に触れるため**フル区分**。

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 集約と除外 | D-9 | T-9 | OK |
| AC-2 AGENTS.md ロード | D-1 | T-1, T-13 | OK |
| AC-3 Skill 明示/暗黙起動 | D-2 | T-2, T-13 | OK |
| AC-4 サブエージェント委任 | D-3 | T-3, T-14 | OK |
| AC-5 コマンド起動 | D-4 | T-4, T-14 | OK |
| AC-6 Hook 発火 | D-5 | T-5, T-13 | OK |
| AC-7 MCP＋キー除去 | D-6 | T-6, T-11, T-14 | OK |
| AC-8 承認/サンドボックス | D-7 | T-7, T-12 | OK |
| AC-9 自動メモリ移植 | D-1, D-8 | T-1, T-10 | OK |
| AC-10 harness-map 更新 | D-10 | T-8 | OK |
| AC-11 trust 設定 | D-11 | T-0, T-13 | OK |

> 漏れ・孤立の有無: 全 AC に設計要素・タスクが対応。要求に紐づかない設計・タスクなし。

## 前提・未決事項

### 要ユーザー判断（解消済み・2026-06-27 承認）

- [x] Q-1: 検証完了後の `.claude/` の扱い → **残置**（削除しない）。
- [x] Q-2: MCP 平文キー（stitch）のローテーション → **ローテーションする**。
- [x] Q-3: メモリ運用方式 → **推奨案採用**（ルール系(feedback/user 5件)＋索引を AGENTS.md 本体統合、文脈系は明示 read）。

### 設計上の前提（崩れると設計が変わる）

- 前提1: Skill 暗黙起動が Codex でも `description` で発火（公式記載あり・実機未確認）。
- 前提2: hook スクリプト移植後（stdin JSON / `cwd` 取得）に detect-bolt-complete が発火。
- 前提3: trust 設定後に `.codex/` の config・hooks が確実に読まれる（起動ログ確認）。
- 前提4: スキル探索パスが `.agents/skills/`（`.codex/skills/` ではない）。

## 影響範囲

- `docs/` への影響 / 更新案: `repository-structure.md` に `.agents/` `.codex/` `migration/` の役割を追記。`CLAUDE.md` は `AGENTS.md` に置換（運用文書の参照先更新）。
- 既存コード・機能への影響: apps/web 等のロジック非変更。`wbs/scripts/` は Hook/コマンド依存で同梱。
- マイグレーション・後方互換: Claude Code は置換のため非保守。検証完了まで `.claude/` を残置。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| セキュリティ/プライバシー | `.mcp.json` に stitch の平文 API キー。ローカルコピーで複製・露出する | T-6 で環境変数参照化、T-11 で secret-scan、Q-2 でローテーション提起 |
| セキュリティ/プライバシー | 自動メモリ・実データの混入リスク | T-9 除外リスト＋T-11 scan。memory は合成/方針データのみだが集約時に再確認 |
| アーキテクト | Codex の一部仕様が実機未確認のまま全変換すると手戻り | Phase 分割（変換→集約→検証）。検証3点(T-13)を明示 |
| PM | 「フル再現」がスコープ肥大しないか | 非スコープを明記（連携 Hook・settings.local・コード変更を除外） |
| QA | 移行の成否判定が曖昧になりがち | AC-1〜10 を検証可能な形で定義、Phase C で疎通確認 |

### 第二意見（フル区分は必須）

- 手段: grilling（2026-06-27 実施）＋ Web 公式ドキュメント検証 ＋ **codex:codex-rescue による設計レビュー（2026-06-27 実施）**
- 機能調査の要点:
  - 当初前提「Codex に Skill/サブエージェント/Hook が無い」は**誤り**。公式で Skill(SKILL.md標準)・サブエージェント(`.codex/agents`)・Hook(Claude互換イベント)・MCP を確認。
- **Codex 設計レビューの指摘と反映（重要）**:
  | 指摘 | 重大度 | 反映 |
  |---|---|---|
  | AGENTS.md は外部メモリを自動注入しない（リンク参照では読まれない） | 高（サイレント失敗） | D-1/D-8: ルール系＋索引を本体統合、文脈系は明示 read（Q-3） |
  | trust 未設定で `.codex/` config・hooks・rules が全スキップ | 高 | D-11/T-0/AC-11 を最優先で新設 |
  | Hook 入力は stdin JSON、`${CLAUDE_PROJECT_DIR}` 不在 | 中 | D-5/T-5: スクリプトを `cwd`/`git rev-parse` へ移植 |
  | `${VAR}` TOML 展開は非公式 | 中 | D-6/T-6: `env_vars`/`bearer_token_env_var` 等の公式フィールドへ |
  | AGENTS.md は近いディレクトリが後出し優先（マージ方向） | 低 | D-1 記述修正 |
  | サブエージェントは明示起動のみ（自動ディスパッチ無し） | 低 | D-3/T-3: 移行ノートで告知 |
  | スキル探索は `.agents/skills/`（`.codex/skills/` でない） | 低 | T-2/前提4 で実機確認 |
  - codex-rescue の実機シェルは現 Claude 側 DevContainer の bwrap 名前空間エラーで使えず、レビューは公式仕様知識ベース。移行先 DevContainer では Codex 動作実績ありで不問。

## 承認

- [x] Q-1, Q-2, Q-3 を解消（未決事項ゼロ）— 2026-06-27
- [x] トレーサビリティ表に漏れ・孤立なし
- [x] 上記をもって requirements / design / tasklist をまとめて承認 — 2026-06-27

> Q-1 残置に伴い、tasklist T-15 を「`.claude/` は残置で確定（削除判断不要）」に更新。
