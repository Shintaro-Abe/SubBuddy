# タスクリスト — Codex CLI 開発環境への移行

## Phase 0: 信頼設定（最優先・Codexレビュー指摘）

- [x] T-0a: リポ内準備 — `.codex/config.toml` 骨格作成＋`migration-notes.md` に trust 設定手順を記載（`[projects."<path>"]` `trust_level="trusted"`） … D-11
- [ ] T-0b: 移行先で `~/.codex/config.toml` に trust 設定し、起動ログで `.codex/` config・hooks 読込を確認（移行先依存） … D-11 / AC-11（migration-notes.md）

## Phase A: 変換（リポ内で Codex 形式を作成）

- [x] T-1: `AGENTS.md` を作成 = `CLAUDE.md` 本体（Codex向け固有名詞調整）＋ **ルール系メモリ(feedback 5件中、未カバー3件を統合・重複2件は索引参照)＋MEMORY.md索引(16件)を統合**。**実測18.6KB / 32KiB以内**。マージ方向・明示read運用を明記 … D-1 / AC-2,AC-9
- [x] T-2a: `.claude/skills/` 9個を `.agents/skills/` へコピー完了（assets/scripts/references 同梱、`.claude` 残置=Q-1、既存 grilling/grill-me と差分なし）。grill-me の `disable-model-invocation` は **SKILL.md 標準キーのため残置**（openai.yaml 退避は不要と判断）→ 暗黙起動抑止を実機検証（T-13）。`.agents/skills/` 探索パスも実機確認 … D-2 / AC-3
- [x] T-2b: skill 本文の Claude 固有委任先・参照を Codex へ調整完了。feature-research の委任先を `deep-research`/`explore`/`plan`/`adversarial-review`/`knowledge-scribe` へ差し替え。全 skill で `CLAUDE.md`→`AGENTS.md`、`.claude/skills/`→`.agents/skills/`、`~/.claude/.gitleaks_confirmed`→`~/.codex/.gitleaks_confirmed`、"Claude Code 制御"→"エージェント制御" に統一（grep で残存ゼロ確認） … D-2 / AC-3
- [x] T-3a: 既存3個（knowledge-scribe, aws-architecture-reviewer, cc-intel-scribe）を `.codex/agents/*.toml` へ変換完了（本文を `developer_instructions` の literal 文字列へ、frontmatter→name/description/sandbox_mode）。aws の auto-memory パスを `memory/` 参照へ調整。cc-intel-scribe は Claude Code 情報用のまま残置（転用時は読み替え） … D-3 / AC-4
- [x] T-3b: 委任先4個を新規 toml 定義完了（explore / plan / deep-research / adversarial-review＝旧codex:rescue相当、全て read-only）。明示起動のみ … D-3 / AC-4
- [x] T-4: wbs-sync を `.agents/skills/wbs-sync/SKILL.md` へ Skill 化（`AskUserQuestion` 参照をツール非依存の確認ゲート表現に一般化、wbs/scripts 依存は Phase B で同梱）。**label-issue は GitHub Actions 専用のため非スコープ**（migration-notes 記載） … D-4 / AC-5
- [x] T-5: `.codex/hooks/hooks.json`（PostToolUse matcher=`Edit|Write`→detect-bolt-complete）を作成。command を `$(git rev-parse --show-toplevel)` 起点に（`${CLAUDE_PROJECT_DIR}` 不在）。**スクリプト本体は既に stdin JSON＋`input.cwd` 優先設計のため無改修で互換**（CLAUDE_PROJECT_DIR はフォールバックで無害）。matcher 実名・payload 構造は実機検証（migration-notes） … D-5 / AC-6
- [x] T-6: MCP 4サーバ（obsidian/stitch/google-slides/napkin-ai）を `config.toml` `[mcp_servers.<name>]` 化完了。**stitch 平文キー除去 → `env_vars=["STITCH_API_KEY"]`、napkin は `env_vars=["NAPKIN_API_KEY"]`＋非秘密設定を env テーブルに**（`${VAR}`非依存。公式書式を MCP ドキュメントで確認済み） … D-6 / AC-7
- [x] T-7: `config.toml` に `approval_policy="on-request"` / `sandbox_mode="workspace-write"` を設定（暫定値、移行先運用で調整可） … D-7 / AC-8
- [x] T-8: Codex 版 `.codex/harness/harness-map.md` を新規作成（コンポーネント一覧・Claude→Codex 対応・等価でない点・Mermaid 図）。`docs/repository-structure.md` のトップレベル構成に AGENTS.md/.agents/.codex/memory/migration を追記。旧 `.claude/harness/harness-map.md` は残置 … D-10 / AC-10

## Phase B: 集約（migration/）

- [ ] T-9: `migration/` にリポ一式を集約（除外: node_modules/.next(" 2"重複)/.git/.env系/シークレット/settings.local.json） … D-9 / AC-1
- [ ] T-10: 文脈系メモリ（project/reference 型）を git 管理外コピーで集約、索引から明示 read できる配置に。ルール系は T-1 で AGENTS.md 統合済み … D-8 / AC-9
- [ ] T-11: 集約物に平文シークレットが残っていないか secret-scan（gitleaks ソース限定） … 制約 / AC-7

## Phase C: 検証（移行先 DevContainer）

- [ ] T-12: `migration/` を移行先 DevContainer へローカルコピー、Codex 起動確認 … AC-8
- [ ] T-13: 要検証4点 … 前提1〜4
  - [ ] trust 設定後に `.codex/` config・hooks が読まれる（AC-11）
  - [ ] AGENTS.md 本体(統合済みルール＋索引)がロードされる（AC-2,AC-9）
  - [ ] Skill が `.agents/skills/` から明示＋暗黙起動で発火（AC-3）
  - [ ] 移植後 Hook(detect-bolt-complete) が stdin JSON で発火（AC-6）
- [ ] T-14: サブエージェント委任／コマンド／MCP 接続の疎通確認 … AC-4,AC-5,AC-7
- [ ] T-15: `.claude/` は**残置で確定**（Q-1）。検証完了後も削除しない。Codex 用と並存。

## 完了条件

- 全 AC（AC-1〜AC-10）が満たされ、トレーサビリティ表に漏れ・孤立なし。
- 移行先 Codex で SubBuddy の通常開発（編集・Hook・Skill・MCP）が一通り動く。
