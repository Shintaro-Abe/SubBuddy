#!/usr/bin/env bash
# gemini-ask.sh — Gemini CLI を「読み取り専用・隔離 cwd」で叩く薄いトランスポート。
#
# 使い方:
#   echo "<プロンプト本文>" | gemini-ask.sh [model]
#     model: flash(既定) | pro | 任意のモデルID（例 gemini-2.5-flash）
#
# 設計意図:
#   - --approval-mode plan + --skip-trust で読み取り専用（編集/コミット不可）。
#   - mktemp した一時ディレクトリで起動し、リポジトリを workspace に含めない。
#     → Gemini がローカル実データ/コードを暗黙に読み外部送信する事故を防ぐ（PII 方針）。
#   - 認証未設定ならハングせず exit 3 でログイン手順を案内。
set -euo pipefail

# --- モデル別名 -------------------------------------------------------------
RAW_MODEL="${1:-flash}"
case "$RAW_MODEL" in
  flash) MODEL="gemini-2.5-flash" ;;
  pro)   MODEL="gemini-2.5-pro" ;;
  *)     MODEL="$RAW_MODEL" ;;
esac

# --- gemini バイナリ解決 ----------------------------------------------------
if command -v gemini >/dev/null 2>&1; then
  GEMINI=(gemini)
else
  GEMINI=(npx --yes @google/gemini-cli)
fi

# --- 認証チェック（ハング回避のため事前に判定） -----------------------------
# 方針：API キー認証を優先しつつ、OAuth ログインも引き続き許容する。
#   - API キー: 環境変数(GEMINI_API_KEY / GOOGLE_API_KEY) ・ ~/.gemini/.env ・
#               settings.json の security.auth.selectedType="gemini-api-key" 等で設定済み。
#   - OAuth   : ~/.gemini/oauth_creds.json（無料枠 = Gemini Code Assist）。
# settings.json のキー名は CLI 版により selectedAuthType / selectedType の両方がありうるため両対応。
GEM_DIR="${HOME}/.gemini"

authed=0
# API キー（環境変数）
if [ -n "${GEMINI_API_KEY:-}" ] || [ -n "${GOOGLE_API_KEY:-}" ]; then authed=1; fi
# API キー（~/.gemini/.env に記載）
if [ -f "${GEM_DIR}/.env" ] && grep -qE 'GEMINI_API_KEY|GOOGLE_API_KEY' "${GEM_DIR}/.env" 2>/dev/null; then authed=1; fi
# 認証タイプ選択済み（API キー or OAuth。新旧キー名どちらも許容）
if [ -f "${GEM_DIR}/settings.json" ] && grep -qE 'selectedAuthType|selectedType' "${GEM_DIR}/settings.json" 2>/dev/null; then authed=1; fi
# OAuth / 資格情報ファイル
if [ -f "${GEM_DIR}/oauth_creds.json" ] || [ -f "${GEM_DIR}/gemini-credentials.json" ]; then authed=1; fi

if [ "$authed" -ne 1 ]; then
  cat >&2 <<'EOF'
[gemini-ask] Gemini の認証が未設定です。いずれかの方法で設定してください。

  【推奨】API キー認証:
    - 環境変数に設定:        export GEMINI_API_KEY=<your-key>
    - または ~/.gemini/.env: GEMINI_API_KEY=<your-key>
    - settings.json の security.auth.selectedType を "gemini-api-key" にしておく。

  【代替】OAuth ログイン（無料枠 = Gemini Code Assist）:
    VS Code の統合ターミナルで（Claude の "! " ではなく）対話起動:  gemini
    → "Login with Google" を選択しブラウザで認可。
       ※ OAuth は TTY＋ブラウザが必要なため Claude の "! " 経由では完了できません。

設定後にこのスキルを再実行してください。
EOF
  exit 3
fi

# --- プロンプト本文を stdin から受領 ----------------------------------------
PROMPT="$(cat)"
if [ -z "${PROMPT//[[:space:]]/}" ]; then
  echo "[gemini-ask] プロンプトが空です（stdin から本文を渡してください）。" >&2
  exit 2
fi

# --- 隔離 cwd で読み取り専用実行 --------------------------------------------
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

exec "${GEMINI[@]}" \
  --skip-trust \
  --approval-mode plan \
  -m "$MODEL" \
  -o text \
  -p "$PROMPT"
