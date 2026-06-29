#!/usr/bin/env bash
# Register a Gemini API key for local Gemini CLI use.
# The key is written only to ~/.gemini/.env, never to this repository.
set -euo pipefail

GEMINI_DIR="${HOME}/.gemini"
ENV_FILE="${GEMINI_DIR}/.env"
SETTINGS_FILE="${GEMINI_DIR}/settings.json"

mkdir -p "${GEMINI_DIR}"
chmod 700 "${GEMINI_DIR}"

printf 'Gemini API keyを入力してください。入力内容は表示されません。\n' >&2
read -rsp 'GEMINI_API_KEY: ' GEMINI_API_KEY
printf '\n' >&2

if [ -z "${GEMINI_API_KEY}" ]; then
  printf 'エラー: APIキーが空です。\n' >&2
  exit 1
fi

cat > "${ENV_FILE}" <<KEYEOF
GEMINI_API_KEY=${GEMINI_API_KEY}
KEYEOF
chmod 600 "${ENV_FILE}"

cat > "${SETTINGS_FILE}" <<'JSONEOF'
{
  "security": {
    "auth": {
      "selectedType": "gemini-api-key"
    }
  }
}
JSONEOF
chmod 600 "${SETTINGS_FILE}"

unset GEMINI_API_KEY
printf '完了: Gemini APIキーを ~/.gemini/.env に保存し、APIキー認証を選択しました。\n' >&2
