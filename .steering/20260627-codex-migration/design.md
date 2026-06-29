# 設計 — Codex CLI 開発環境への移行

## 実装アプローチ

3 フェーズで進める。フル忠実再現を目標とするが、Codex の一部仕様（Skill 暗黙起動・メモリ参照・Hook 入出力等価性）は未検証のため、**変換 → 集約 → 検証**の順で手戻りを抑える。

```
[Phase 0 信頼]  trust設定(D-11)。.codex/ の config・hooks が読まれる前提を確立
      ↓
[Phase A 変換]  Claude資産を Codex 形式へ（リポ内で作成）
      ↓
[Phase B 集約]  migration/ にリポ一式＋git管理外資産を集約（除外適用）
      ↓
[Phase C 検証]  移行先DevContainerへローカルコピー → Codex起動 → 検証
```

> Codexレビュー（2026-06-27）で「memory自動注入なし」「trust未設定で.codex/全スキップ」「hook入力はstdin JSONで`${CLAUDE_PROJECT_DIR}`不在」「`${VAR}`展開は非公式」を指摘され、本設計に反映済み。

## 変換マッピング（設計要素）

### D-1 AGENTS.md（← CLAUDE.md ＋ ルール系メモリ）
- `CLAUDE.md`(17KB) を `AGENTS.md` としてリポルートに作成。
- **重要修正（Codexレビュー）**: Codex は AGENTS.md 内のリンク参照で外部ファイルを自動ロードしない。ルールがサイレントに効かなくなるため、**ルール的メモリ（feedback/user 型 5件・6.3KB）と `MEMORY.md` 索引(4.3KB) を AGENTS.md 本体に直接統合**する。合計 ≒27KB で 32KiB 以内。
- マージ方向の正しい理解: Codex は グローバル(`~/.codex/AGENTS.md`)→リポルート→CWD に近い順で連結し、**近いディレクトリほど後出しで優先**。本設計はプロジェクトルート1枚に集約しグローバルは使わない。
- 末尾に「`memory/` の project/reference 型は自動ロードされない。関連時に明示 read する（Codex に自動書込み機構なし、更新は手動）」を明記。

### D-2 Skills（← .claude/skills/ 9個）
- `.agents/skills/<name>/SKILL.md`（Codex 公式の探索パス：`$REPO_ROOT/.agents/skills`）へ移設。
- frontmatter は `name`/`description` のみ必須。Claude 固有の追加メタは `agents/openai.yaml` へ退避。
- `scripts/` `references/` `assets/` はそのまま同梱可。
- 既存 `.agents/skills/`（grill-me, grilling）と統合。
- 対象: aws-architecture-review, drawio, feature-research, gemini, grilling, grill-me, handoff, pre-commit-secret-scan, procedure-guide。

### D-3 サブエージェント（← .claude/agents/ ＋ skill 委任先を全て agents 化）
- `.codex/agents/<name>.toml` を作成。`name`/`description`/`developer_instructions` 必須、必要に応じ `model`/`sandbox_mode`/`skills.config`/`mcp_servers` を付与。
- 既存変換（`.claude/agents/*.md` の frontmatter→TOML、本文→`developer_instructions`）:
  - knowledge-scribe, aws-architecture-reviewer, cc-intel-scribe
- **委任先の新規定義（Q: 全サブエージェント化）**: Claude built-in / 固有スキルに依存していた委任先も明示 toml 化する。
  - `explore`（read-only, コードベース探索。Claude Explore 相当）
  - `plan`（設計立案。Claude Plan 相当）
  - `deep-research`（出典付き外部調査。`web_search` 活用、read-only）
  - `adversarial-review`（旧 codex:rescue 相当。別観点での批判的反証）
- feature-research skill 本文の委任先名を、上記 `.codex/agents/` の名前へ差し替える（T-2b）。
- 全て**明示起動のみ**（自動ディスパッチ無し）。利用者へ告知。

### D-4 コマンド（← .claude/commands/ 2個）
- `.codex/prompts/` は非推奨のため Skill 化を基本とする。wbs-sync / label-issue を `.agents/skills/` 配下へ。
- wbs-sync は `wbs/scripts/`（sync.ts / init-sheets.ts）に依存 → 同梱必須。

### D-5 Hook（← settings.json hooks ＋ wbs/scripts）
- `.codex/hooks/hooks.json`（または `config.toml` インライン）に PostToolUse(matcher=`Edit|Write`)→`detect-bolt-complete.mjs` を定義。イベント名は Claude Code 互換。
- **重要修正（Codexレビュー）**: Codex の Hook 入力は **stdin の JSON オブジェクト**（session_id/transcript_path/cwd/hook_event_name 等）。`${CLAUDE_PROJECT_DIR}` 相当の環境変数は**存在しない**。`detect-bolt-complete.mjs` は無改修では動かないため、プロジェクトルート取得を `cwd` フィールド or `git rev-parse --show-toplevel` に**移植する**。
- 前提: project スコープ hooks は **trusted project でないとスキップ**（D-11 が先行）。
- `codex@openai-codex` プラグインの Hook は移植しない（非スコープ）。

### D-6 MCP（← .mcp.json 4個）
- `~/.codex/config.toml` または `.codex/config.toml`（trusted project）の `[mcp_servers.<name>]`（command/args/env/cwd）へ。
- **重要修正（Codexレビュー）**: TOML 文字列内の `${VAR}` 展開は Codex 仕様に明記がなく、展開されないと平文残存 or 接続失敗。秘密情報は Codex 公式フィールド（`env_vars` / `bearer_token_env_var` / `env_http_headers` 等）で間接参照する。stitch の `STITCH_API_KEY` 直書きを除去し、env 由来で注入。napkin の `NAPKIN_API_KEY` も同様。
- 前提: `.codex/config.toml` は **trusted project のみ有効**（D-11 が先行）。
- 対象: obsidian, stitch, google-slides, napkin-ai。

### D-11 trust 設定（新規・最優先）
- **重要追加（Codexレビュー）**: `.codex/` 配下の config・hooks・rules は **trusted project でないと全てスキップ**される。`projects.<path>.trust_level` を設定し、Codex 起動ログで読み込みを確認してから他フェーズへ進む。これが Phase A の前提。

### D-7 承認/サンドボックス（← settings.local.json 権限）
- 逐語移植せず `config.toml` に `approval_policy` / `sandbox_mode` を設定。DevContainer が隔離境界のため運用実績に合わせる。

### D-8 自動メモリ（← ~/.claude/.../memory/ 22件・116KB）
- **重要修正（Codexレビュー）**: 「AGENTS.md から参照すれば読まれる」は誤り（自動注入なし）。2 層に分割する。
  - **ルール系（feedback/user 型・5件 6.3KB）＋ `MEMORY.md` 索引(4.3KB)** → D-1 で AGENTS.md 本体に直接統合（確実にロード）。
  - **文脈系（project/reference 型）** → `migration/` 経由で参照可能パスへ物理コピー。索引から辿り、関連時に**明示 read** する運用。
- 自動更新機構は Codex に無いため手動運用に切替（AGENTS.md に明記）。
- **要確認（Phase A 着手前）**: config-reference にトップレベル `memories.*` キーが存在する。Codex に公式メモリ機構がある可能性があり、あれば Q-3 の運用（本体統合＋明示read）を上書きできる。移行先で挙動を確認し、有効なら memories 機構へ寄せる。

### D-9 集約と除外（migration/）
- 集約: リポ一式 ＋ git 管理外資産（memory/, 必要な作業中ファイル）。
- 除外: `node_modules`, `.next`(" 2" 重複含む), `.git`, `.env`系, gitignore 済みシークレット, `settings.local.json`。

### D-10 ハーネスマップ更新
- `harness-map.md` を Codex 版に書き換え、または `docs/` へ移設して SSOT を維持。

## 影響範囲の分析

- `docs/`: `repository-structure.md` に `.agents/`・`.codex/`・`migration/` の役割追記が必要。`CLAUDE.md`（プロジェクトメモリ）は AGENTS.md に置換されるため、本リポの運用文書の参照先更新が要る。
- 既存コード: apps/web 等のロジック非変更。`wbs/scripts/` は Hook/コマンド依存で同梱。
- 後方互換: Claude Code は置換のため非保守。ただし `.claude/` を即削除せず、検証完了まで残す。

## 等価にならない箇所（Codexレビューで確定・サイレント消失に注意）
- Claude の**自動専門家ディスパッチ**（description マッチでサブエージェント自動選択）→ Codex はサブエージェント明示起動のみ。利用者へ告知。
- Claude hook の環境変数（`CLAUDE_PROJECT_DIR` 等）→ Codex は stdin JSON。スクリプト移植で吸収（D-5）。
- AGENTS.md リンクによる外部メモリの自動注入→ 存在しない。本体統合＋明示 read で吸収（D-1/D-8）。

## 未検証の前提（崩れると設計変更）
- 前提1: Skill 暗黙起動が Codex でも `description` で発火する（公式記載あり、実機未確認）。
- 前提2: hook スクリプト移植後（stdin JSON / cwd 取得）に detect-bolt-complete が Codex で発火する。
- 前提3: trust 設定後に `.codex/` の config・hooks が確実に読まれる（D-11 で起動ログ確認）。
- 前提4: スキル探索パスが `.codex/skills/` ではなく `.agents/skills/` である（実機確認）。
