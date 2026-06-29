---
name: gemini-consult-skill
description: /gemini 軽量Gemini相談スキルの仕様と初回OAuthログイン要件
metadata: 
  node_type: memory
  type: project
  originSessionId: 8be7115e-37b5-468d-8973-55a314a0ef1a
---

`/gemini` は Gemini CLI（無料OAuth枠）をブリッジする軽量・高頻度の汎用相談窓口スキル（`.claude/skills/gemini/`）。出典付きクイックWeb調査が主で、第二意見・要約・翻訳も担う。重い実装戦略立案は [[feature-research]] 系（`feature-research` スキル）に任せる棲み分け。

**認証は無料 OAuth のみ（API キーは使わない方針／ユーザー決定 2026-06-05）**。helper は `GEMINI_API_KEY`・`~/.gemini/.env` を一切扱わず、`~/.gemini/oauth_creds.json` か `settings.json:selectedAuthType` だけを確認する。初回ログインは **VS Code 統合ターミナルで** `gemini` を起動し "Login with Google"（無料枠 = Gemini Code Assist）。Claude の `! ` は非対話TTYのため OAuth ログインを完了できない（`! gemini` は認証エラーを出すだけ）＝手順案内のみ。未設定時は helper が exit 3 で案内。

**安全設計**：helper `scripts/gemini-ask.sh` は `--approval-mode plan`（読み取り専用）＋`--skip-trust`＋`mktemp -d` の隔離cwdで gemini を起動し、リポジトリを workspace に渡さない。Gemini にローカル実データ/コードを暗黙に読ませない（[[dev-env-quirks]] と同じ PII 方針）。コード文脈が要る時だけ Claude が PII 確認済み抜粋をプロンプトに貼る。

モデル別名：`flash`(既定=gemini-2.5-flash) / `pro`(gemini-2.5-pro)。認証未設定時は helper が exit 3 でログイン手順を案内（ハングしない）。
