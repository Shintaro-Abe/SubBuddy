#!/bin/bash
# post_create.sh: コンテナ生成時に 1 回だけ実行されるセットアップスクリプト。
#
# 構成要素（順序に意味あり）:
#   §1 Claude Code CLI インストール
#   §2 uv（Python パッケージマネージャ、deploy-on-aws プラグイン MCP 用）
#   §3 inotify-tools（Claude OAuth トークン監視用）
#   §4 cron インストール（方式 A sync 用）
#   §5 Claude Code dashboard sync スクリプト配置（方式 A）
#   §6 crontab 登録（既存ジョブ温存）
#   §7 Codex CLI + codex@openai-codex プラグインインストール
#   §8 watcher スクリプト権限付与
#   §9 bashrc watcher 自動起動フォールバック
#   §10 SSO 初回ログイン誘導メッセージ
#
# 転用時に書き換える定数（§0）:
#   PROJECT_NAME    : 他プロジェクト名（kebab-case）
#   WORKSPACE_DIR   : devcontainer.json の workspaceFolder と同値

set -euo pipefail

# ===== §0 転用時に変更が必要な定数 =====
PROJECT_NAME="SubBuddy"
WORKSPACE_DIR="/workspaces/SubBuddy"
WATCHER_MARKER="${PROJECT_NAME} token watcher"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ===== §0.5 ~/.claude ボリュームの所有権補正 =====
# devcontainer.json で ~/.claude を Docker named volume にマウントしている場合、
# 初回マウント時の所有権は root になり vscode ユーザは書き込めない。
# これを補正しないと §7 の `claude plugin install` が EACCES、
# post_start.sh の `tee ~/.claude/post_start.log` が Permission denied になる。
# 冪等なので毎回実行して問題なし。
sudo chown -R "$USER:$USER" "$HOME/.claude"

# ===== §1 Claude Code CLI =====
npm install -g @anthropic-ai/claude-code

# npm install -g 直後に bash が PATH キャッシュを持っているため、
# 新規バイナリ (claude) の解決のためキャッシュをクリア
hash -r 2>/dev/null || true

# ===== §2 uv (Python package manager) =====
# required for deploy-on-aws plugin MCP servers
curl -LsSf https://astral.sh/uv/install.sh | sh

# PATH 追記は冪等化（Rebuild 時の重複防止）
if ! grep -qF '.local/bin' ~/.bashrc 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi
if ! grep -qF '.local/bin' ~/.profile 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.profile
fi

# ===== §3 inotify-tools =====
# Claude OAuth トークンのファイル監視に必要
sudo apt-get update -qq
sudo apt-get install -y -qq inotify-tools

# ===== §4 cron インストール =====
# 方式 A: 1 分間隔で ~/.claude/projects/ を S3 に sync するため
sudo apt-get install -y -qq cron

# ===== §5 claude-sync.sh 配置 =====
# AWS CLI v2 の実パスを動的解決（features のインストール先が
# /usr/local/bin/aws と /home/vscode/.local/bin/aws のどちらに
# 落ちるか base image / feature バージョンに依存するため）
AWS_BIN="$(command -v aws || true)"
if [ -z "$AWS_BIN" ]; then
    echo "ERROR: aws CLI not found." >&2
    echo "       Check that ghcr.io/devcontainers/features/aws-cli:1 is in devcontainer.json features" >&2
    exit 1
fi
echo "INFO: AWS CLI detected at: $AWS_BIN"

# 方式 A 規範実装。詳細は claude-code-usage-dashboard リポジトリの
# manuals/new-project-sync-setup.md を参照。
# 単一引用 HEREDOC で書き込み、後段で sed により AWS パスのみ動的注入する。
sudo tee /usr/local/bin/claude-sync.sh > /dev/null <<'SYNC_EOF'
#!/bin/bash
set -euo pipefail

AWS=__AWS_BIN_PLACEHOLDER__
# cron 環境では $USER が未設定で `set -u` が abort するため `id -un` で取得する。
# 値は対話シェルの $USER と同じ（"vscode" 等）になる。
PROJECT="$(id -un)"
AWS_ACCOUNT_ID=$($AWS sts get-caller-identity --profile claude-sync --query Account --output text)
BUCKET="claude-dashboard-${AWS_ACCOUNT_ID}"

# Claude Code を未起動のクリーンなボリュームでも sync が no-op で通るよう
# projects/ を冪等に保証する（aws s3 sync は source 不在で argparse 段階で fail するため）
mkdir -p "$HOME/.claude/projects/"

$AWS s3 sync \
  "$HOME/.claude/projects/" \
  "s3://${BUCKET}/claude-projects/${PROJECT}/" \
  --exclude "*.tmp" \
  --exclude "*.lock" \
  --profile claude-sync
SYNC_EOF

# sed 区切りに `|` を使用（パスに `/` が含まれるため）
sudo sed -i "s|__AWS_BIN_PLACEHOLDER__|${AWS_BIN}|" /usr/local/bin/claude-sync.sh
sudo chmod 755 /usr/local/bin/claude-sync.sh

# ===== §6 crontab 登録 =====
# 既存 crontab を保全しつつ claude-sync.sh 行のみ重複排除＋追記。
# crontab -l がエラー終了する空 crontab 環境にも対応（2>/dev/null）
CRON_LINE='* * * * * /usr/local/bin/claude-sync.sh >> ~/claude-sync.log 2>&1'
(crontab -l 2>/dev/null | grep -v -F 'claude-sync.sh' || true; echo "$CRON_LINE") | crontab -

# ===== §7 Codex CLI + プラグイン =====
# Codex CLI 本体（OpenAI 公式 npm パッケージ）
npm install -g @openai/codex
hash -r 2>/dev/null || true

# codex@openai-codex プラグインを Claude Code に user scope で導入。
# claude コマンドが PATH に解決できることを先に確認し、
# stderr は流して原因が追えるようにする（H-1 対策）。
# install/marketplace add は再実行で「既存」エラーになりうるため
# `|| true` で握りつぶす（冪等性のため）。
if command -v claude >/dev/null 2>&1; then
    claude plugin marketplace add openai/codex-plugin-cc || true
    claude plugin install codex@openai-codex --scope user || true
else
    echo "WARNING: claude CLI not found in PATH after npm install -g." >&2
    echo "         codex@openai-codex plugin install was skipped." >&2
    echo "         After Reopen, run manually:" >&2
    echo "           claude plugin marketplace add openai/codex-plugin-cc" >&2
    echo "           claude plugin install codex@openai-codex --scope user" >&2
fi

# ===== §8 watcher スクリプト権限付与 =====
chmod +x "$SCRIPT_DIR/sync_claude_token.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/watch_claude_token.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/post_start.sh" 2>/dev/null || true

# ===== §9 bashrc watcher 自動起動フォールバック =====
# postStartCommand 不発対策。マーカーで冪等化。
# §0 の PROJECT_NAME / WORKSPACE_DIR を参照する。
# watcher 不使用プロジェクト（watch_claude_token.sh が同階層に無い）では
# bashrc に dead path を仕込まないよう存在チェックを行う。
if [ -f "$SCRIPT_DIR/watch_claude_token.sh" ] \
    && ! grep -Fq "${WATCHER_MARKER}" ~/.bashrc 2>/dev/null; then
    cat >> ~/.bashrc <<BASHRC_EOF

# >>> ${WATCHER_MARKER} >>>
if [ -f "${WORKSPACE_DIR}/.devcontainer/post_start.sh" ] \\
    && ! pgrep -f watch_claude_token.sh > /dev/null 2>&1; then
    bash "${WORKSPACE_DIR}/.devcontainer/post_start.sh" > /dev/null 2>&1
fi
# <<< ${WATCHER_MARKER} <<<
BASHRC_EOF
fi

# ===== §10 SSO 初回ログイン誘導メッセージ =====
cat <<'NOTICE_EOF'

================================================================================
  Claude Code usage dashboard sync (方式 A) セットアップ完了

  次のステップ:

    1. SSO プロファイル設定（初回 + Rebuild ごと）:
       ※ ~/.aws/config は Docker volume にマウントしていないため、
          Rebuild Container 実行時に消失する。毎回再設定が必要。
       aws configure sso --profile claude-sync
         SSO start URL  : <組織の SSO 開始 URL>
         SSO Region     : ap-northeast-1
         Account ID     : <ダッシュボード AWS アカウント ID>
         Role           : <s3:PutObject on claude-projects/* を持つロール>
         Default region : ap-northeast-1
         Default output : json

    2. ログイン（初回 + Rebuild 後 + SSO セッション失効時のみ。
       IAM Identity Center で sessionDuration を 90 日に設定していれば、
       同一コンテナ内では最大 90 日に 1 回で済む。
       一時クレデンシャルは AWS CLI が自動再発行するため不要）:
       aws sso login --profile claude-sync

    3. 疎通確認:
       aws sts get-caller-identity --profile claude-sync
       which aws    # /usr/local/bin/aws と同じか確認（違っても sync は動作する）
       tail -5 ~/claude-sync.log  # 1〜2 分後に確認

  詳細手順:
    claude-code-usage-dashboard/manuals/new-project-sync-setup.md
================================================================================

NOTICE_EOF
