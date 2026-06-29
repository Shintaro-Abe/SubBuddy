# 移行先での手作業ノート — Codex CLI

> リポ内で作れない「移行先 DevContainer での手作業」を集約する。Phase C の実機検証で消し込む。

## Phase 0: trust 設定（最優先・T-0 / AC-11）

`.codex/` の config・hooks・rules は **trusted project でないと全スキップ**される。移行先で以下を実施。

1. 移行先のプロジェクト絶対パスを確認（例: `/workspaces/SubBuddy`）。
2. グローバル設定 `~/.codex/config.toml` に追記:
   ```toml
   [projects."/絶対パス/SubBuddy"]
   trust_level = "trusted"
   ```
   （`trust_level` は `"trusted"` | `"untrusted"`）
3. Codex を起動し、起動ログで project-scoped `.codex/config.toml` と hooks が**読み込まれている**ことを確認。
4. 読み込まれない場合はパス不一致 or trust 未反映を疑う。

> 確認できるまで Phase A 以降の検証は無効（設定が読まれていない可能性があるため）。

## 移行先での環境変数（T-6 / MCP シークレット）

平文キーを config.toml に直書きしない。移行先で以下を env 注入（DevContainer env / direnv 等）:

- `STITCH_API_KEY` — **要ローテーション**（Q-2 で決定。旧キー `AQ.Ab8RN6...` は失効させる）
- `NAPKIN_API_KEY`
- （google-slides / obsidian が鍵を要する場合は追記）

## 非スコープ（移植しないもの）

- `codex@openai-codex` プラグインの hook（`stop-review-gate` / `session-lifecycle`）＝ Claude→Codex 連携専用。ネイティブ Codex では役割消滅。
- `settings.local.json`（個人権限許可リスト）＝ Codex は承認モデルが別（`approval_policy`/`sandbox_mode` で再設定）。
- `.claude/commands/label-issue.md` ＝ **GitHub Actions（Claude Code Action）専用テンプレート**。`${{ github.event.issue.number }}` 等の Actions 変数に依存し、Codex CLI ローカル開発では機能しない。CI で issue ラベリングが必要なら別途 Actions 側で構成する。

## 利用者への告知（サブエージェント）

- `.codex/agents/*.toml` のサブエージェント（knowledge-scribe / aws-architecture-reviewer / cc-intel-scribe / explore / plan / deep-research / adversarial-review）は**明示起動のみ**。Claude のような自動ディスパッチは無い。必要なときに明示的に呼ぶ。
- `cc-intel-scribe` は Claude Code 製品情報の記録用。Codex 自身の情報を記録したい場合は本文を Codex 向けに読み替える。

## Phase C 実機検証チェック（T-13 / T-14）

- [ ] trust 後に `.codex/` config・hooks が読まれる（AC-11）
- [ ] AGENTS.md 本体（統合ルール＋索引）がロードされる（AC-2, AC-9）
- [ ] Skill が `.agents/skills/` から明示＋暗黙起動で発火（AC-3, 前提4）
- [ ] **grill-me の `disable-model-invocation` が効き、暗黙起動が抑止される**（効かない場合は `agents/openai.yaml` で制御）
- [ ] 移植後 Hook（detect-bolt-complete, stdin JSON）が発火（AC-6, 前提2）
  - [ ] **Codex のファイル編集ツール名を確認**し、`.codex/hooks/hooks.json` の matcher `Edit|Write` を実名に調整（Codex のツール名が異なる可能性）
  - [ ] **hook 入力 payload の構造**を確認（スクリプトは `input.tool_input.file_path` と `input.cwd` を参照。Codex が同構造で渡すか）
  - [ ] command の `$(git rev-parse --show-toplevel)` でプロジェクトルートが解決されることを確認
- [ ] サブエージェント（.codex/agents/*.toml）が明示起動で委任（AC-4）
- [ ] コマンド（Skill 化した wbs-sync / label-issue）が起動（AC-5）
- [ ] MCP 4サーバが接続（AC-7）
- [ ] `memories.*` 機構の有無と挙動を確認 → Q-3 運用の最終確定
