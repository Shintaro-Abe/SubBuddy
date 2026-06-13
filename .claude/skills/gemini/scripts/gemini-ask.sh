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

# --- 認証チェック（OAuth 限定・ハング回避のため事前に判定） ------------------
# 方針：無料 OAuth ログインのみを使用する。API キー（GEMINI_API_KEY / ~/.gemini/.env）は扱わない。
GEM_DIR="${HOME}/.gemini"

authed=0
if [ -f "${GEM_DIR}/oauth_creds.json" ]; then authed=1; fi
if [ -f "${GEM_DIR}/settings.json" ] && grep -q 'selectedAuthType' "${GEM_DIR}/settings.json" 2>/dev/null; then authed=1; fi

if [ "$authed" -ne 1 ]; then
  cat >&2 <<'EOF'
[gemini-ask] OAuth ログインが未設定です。初回のみログインしてください。

  VS Code の統合ターミナルで（Claude の "! " ではなく）対話起動:
       gemini
  → "Login with Google" を選択しブラウザで認可（無料枠 = Gemini Code Assist）。
     ※ OAuth ログインは TTY＋ブラウザが必要なため、Claude の "! " 経由では完了できません。

ログイン後（~/.gemini/oauth_creds.json が生成される）にこのスキルを再実行してください。
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
