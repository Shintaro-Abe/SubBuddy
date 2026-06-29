# 要求内容 — Codex CLI 開発環境への移行

## 背景・目的

SubBuddy の開発を Claude Code から **OpenAI Codex CLI** に置き換える。現在 Claude Code 上に構築したハーネス（AGENTS相当の指示・Skill・サブエージェント・Hook・MCP・自動メモリ）を、Codex CLI 上で**できる限り等価に再現**し、開発を継続できる状態にする。

転送は git を経由せず、**同一ホスト上のローカルコピー**で行う。`migration/` ディレクトリにリポジトリ一式を集約し、移行先 DevContainer（Codex 環境）へローカルコピーする。

> グリル（2026-06-27）で「Codex には該当機能が無い」という当初前提を公式ドキュメントで検証した結果、想定よりはるかに Claude Code に近いことが判明した。特に Skill は Anthropic が 2025-12 に公開した SKILL.md 標準を OpenAI も採用しており、ほぼそのまま動く。

## 変更・追加する機能の説明

- やること:
  - `migration/` にリポジトリ一式を集約（除外対象を除く）
  - Claude Code のハーネス資産を Codex CLI 形式へ変換
    - `CLAUDE.md` → `AGENTS.md`
    - `.claude/skills/`(9) → `.agents/skills/`（SKILL.md 標準）
    - `.claude/agents/`(3) → `.codex/agents/*.toml`
    - `.claude/commands/`(2) → Skill 化
    - `settings.json` の Hook → `.codex/hooks`（同一スキーマ）＋ `wbs/scripts/` 同梱
    - `.mcp.json`(4) → `config.toml` `[mcp_servers.*]`（**平文キー除去→環境変数参照化**）
    - 自動メモリ `memory/` → 別ディレクトリ保持＋ AGENTS.md から参照
    - 承認/サンドボックス → Codex の `approval_policy`/`sandbox_mode`
  - 移行先で動作検証（要検証項目3点）
- やらないこと:
  - Claude Code 側の保守（置換のため）
  - `codex@openai-codex` プラグインの Hook（`stop-review-gate`/`session-lifecycle`）の移植 — これは Claude Code 上から Codex を呼ぶ**連携専用機能**で、ネイティブ Codex CLI では役割が消滅する
  - `settings.local.json`（個人権限許可リスト）の逐語移植 — Codex は承認モデルが異なる
  - コード本体（apps/web 等）のロジック変更

## ユーザーストーリー

- 開発者として、Codex CLI で SubBuddy リポジトリを開いたとき、Claude Code と同じ指示・Skill・サブエージェント・Hook・MCP が効いてほしい。なぜなら開発体験とガードレール（PII 方針・secret-scan・ステアリング運用）を落とさず移行したいから。

## 受け入れ条件

- [ ] AC-1: `migration/` にリポ一式が集約され、除外対象（`node_modules` / `.next`（" 2" 重複含む） / `.git` / `.env`系 / gitignore 済みシークレット）が含まれない。
- [ ] AC-2: `CLAUDE.md` 由来の `AGENTS.md` が Codex でロードされる（合計サイズが `project_doc_max_bytes`=32KiB 以内）。
- [ ] AC-3: `.claude/skills/` 全9個が `.agents/skills/` 配下に置かれ、Codex から**明示起動（/）**できる。description による**暗黙起動**の発火可否を検証済み。
- [ ] AC-4: `.claude/agents/` 3個が `.codex/agents/*.toml`（name/description/developer_instructions）として委任起動できる。
- [ ] AC-5: `.claude/commands/` 2個（wbs-sync / label-issue）が Codex で起動できる。
- [ ] AC-6: PostToolUse Hook（detect-bolt-complete）が `wbs/scripts/` 同梱で Codex 上で発火する。
- [ ] AC-7: `.mcp.json` 4サーバが `config.toml` で動作し、**平文 API キーが除去**され環境変数参照に統一されている。
- [ ] AC-8: 承認/サンドボックスが Codex 流（`approval_policy`/`sandbox_mode`）に設定され、DevContainer 内で Codex が起動する。
- [ ] AC-9: 自動メモリ `memory/`(22件) が移植され、`AGENTS.md` 経由で参照できる。Codex に自動書込み機構が無い前提を AGENTS.md に明記。
- [ ] AC-10: `harness-map.md` が Codex 版に更新（または `docs/` へ移設）され、現状と乖離しない。
- [ ] AC-11: `.codex/` の config・hooks・rules が読み込まれるよう **trust 設定**が済み、Codex 起動ログで確認できる（未設定だと全スキップ）。

## 制約事項

- **PII・機微データ方針**: 実データを扱わない。`migration/` 集約時に `.env`系・実データ・資格情報を含めない。MCP の平文 API キーは移行を機に環境変数参照化し、可能ならローテーション。
- **ローカルファースト**: 転送は git を経由せず同一ホストのローカルコピー。外部送信しない。
- **設定外出し**: API キー等のシークレットは `config.toml` に直書きせず `${VAR}` 参照。
- **互換性**: コード本体のロジックは変更しない。ハーネスの等価再現に限定。
