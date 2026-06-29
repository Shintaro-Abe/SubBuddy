#!/bin/bash
# post_create.sh: コンテナ生成時に 1 回だけ実行されるセットアップ (Codex CLI 版)。
#
# 構成要素（順序に意味あり）:
#   §0 ~/.codex ボリュームの所有権補正
#   §1 PATH 追記（~/.local/bin: Codex CLI / 各種ローカルバイナリの導入先）
#   §2 Node 依存インストール（apps/web）
#   §3 Prisma クライアント生成
#   §4 gitleaks インストール（pre-commit-secret-scan skill の必須ゲート用）
#   §5 Codex CLI インストール（公式 standalone installer、コンテナ内で実施）
#
# Claude Code 固有の要素（Claude CLI / uv / inotify / cron / S3 dashboard sync /
# OAuth トークン watcher / codex プラグイン / SSO 誘導）は Codex 移行に伴い全て除去した。
#
# 転用時に書き換える定数（§0.0）:
#   WORKSPACE_DIR : devcontainer.json の workspaceFolder と同値

set -euo pipefail

# ===== §0.0 転用時に変更が必要な定数 =====
WORKSPACE_DIR="/workspaces/SubBuddy"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ===== §0 ~/.codex ボリュームの所有権補正 =====
# devcontainer.json で ~/.codex を named volume にマウントすると初回は root 所有になり、
# vscode ユーザが trust 設定・認証情報・gitleaks 確認フラグを書き込めない。
# 冪等なので毎回実行して問題なし。
sudo chown -R "$USER:$USER" "$HOME/.codex" 2>/dev/null || true

# ===== §1 PATH 追記（冪等。Rebuild 時の重複防止）=====
# Codex CLI の standalone installer は ~/.local/bin に配置する。
if ! grep -qF '.local/bin' ~/.bashrc 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi
if ! grep -qF '.local/bin' ~/.profile 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.profile
fi
export PATH="$HOME/.local/bin:$PATH"

# ===== §2 Node 依存（apps/web）=====
corepack enable 2>/dev/null || true
if [ -f "$WORKSPACE_DIR/apps/web/package.json" ]; then
    npm install --prefix "$WORKSPACE_DIR/apps/web"
fi

# ===== §3 Prisma クライアント生成（best-effort）=====
if [ -f "$WORKSPACE_DIR/apps/web/prisma/schema.prisma" ]; then
    ( cd "$WORKSPACE_DIR/apps/web" && npx prisma generate ) || \
        echo "WARNING: prisma generate に失敗（DB 未起動等）。後で手動実行可。" >&2
fi

# ===== §4 gitleaks（pre-commit-secret-scan skill の必須ゲート用）=====
if ! command -v gitleaks >/dev/null 2>&1; then
    GITLEAKS_VERSION="8.18.4"
    ARCH="$(uname -m)"
    case "$ARCH" in
        x86_64)  GL_ARCH="x64" ;;
        aarch64|arm64) GL_ARCH="arm64" ;;
        *) GL_ARCH="x64" ;;
    esac
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GL_ARCH}.tar.gz" \
        | sudo tar -xz -C /usr/local/bin gitleaks \
        || echo "WARNING: gitleaks のインストールに失敗。pre-commit-secret-scan は手動導入が必要。" >&2
fi

# ===== §5 Codex CLI（公式 standalone installer、コンテナ内で実施）=====
# 参照: https://developers.openai.com/codex/cli/
# ローカルホストではなくコンテナ生成時に導入する（要件）。~/.local/bin に配置される。
if ! command -v codex >/dev/null 2>&1; then
    curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh \
        || echo "WARNING: Codex CLI のインストールに失敗。手動で installer を再実行すること。" >&2
fi
hash -r 2>/dev/null || true

cat <<'NOTICE_EOF'

================================================================================
  Codex CLI 開発環境セットアップ完了

  次のステップ:
    1. Codex にログイン:   codex login
    2. プロジェクトを信頼する（.codex/ の config・hooks 読込に必須）:
       ~/.codex/config.toml に以下を追記
         [projects."/workspaces/SubBuddy"]
         trust_level = "trusted"
    3. MCP 用シークレットはローカル環境変数 STITCH_API_KEY / NAPKIN_API_KEY を
       devcontainer.json の containerEnv 経由で引き継ぐ（ホスト側で export 済みのこと）。
    4. PostgreSQL は手動運用: 必要時に `sudo service postgresql start`。
================================================================================

NOTICE_EOF
