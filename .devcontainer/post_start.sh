#!/bin/bash
# post_start.sh: コンテナ起動のたびに実行されるスクリプト。
# Claude OAuth トークンの監視プロセスをバックグラウンドで起動する。
#
# このサンプルは SubBuddy プロジェクトの .devcontainer/post_start.sh の
# 修正案であり、cron デーモンの確実な自動起動を組み込んだもの。
#
# 元のスクリプトとの差分: 9-12 行目 (cron 起動ブロック) のみ追加。
# それ以外は一切変更していない。

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$HOME/.claude/post_start.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[post-start] $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"
}

log "post_start.sh invoked (pid=$$)"

# ★ 追加: cron デーモンを起動 (idempotent、失敗しても続行)
# devcontainer.json の postStartCommand 連結が VS Code の解釈で動作しない問題を回避するため、
# 確実に呼ばれる post_start.sh 内で cron 起動を行う。
# watcher エラーによる早期 exit より前に置くこと。
# SIGPIPE 懸念を避けるため `head | while read` 形式は廃止し、単一の if 分岐で扱う。
if sudo service cron start >/dev/null 2>&1; then
    log "cron: started"
else
    log "cron: start failed (possibly already running)"
fi

# ★ watcher は optional: watch_claude_token.sh が同階層に無ければスキップして正常終了。
# SubBuddy のような OTel/Claude OAuth トークン同期を行うプロジェクトでのみ存在する。
# 新規プロジェクト（dashboard sync のみ利用）では存在しないので exit 0 で終わる。
if [ ! -f "$SCRIPT_DIR/watch_claude_token.sh" ]; then
    log "watcher: watch_claude_token.sh not found in ${SCRIPT_DIR}, skipping (optional)"
    exit 0
fi

if ! command -v inotifywait &> /dev/null; then
    log "ERROR: inotifywait not found. Run post_create.sh first."
    exit 1
fi

if pgrep -f "watch_claude_token.sh" > /dev/null; then
    killed_pids="$(pgrep -f watch_claude_token.sh | tr '\n' ' ')"
    pkill -f "watch_claude_token.sh" 2>/dev/null || true
    log "killed existing watcher(s): ${killed_pids}"
else
    log "no existing watcher found"
fi

nohup bash "$SCRIPT_DIR/watch_claude_token.sh" > /dev/null 2>&1 &
WATCH_PID=$!
sleep 1

if kill -0 "$WATCH_PID" 2>/dev/null; then
    log "watcher started successfully (pid=${WATCH_PID})"
else
    log "ERROR: watcher failed to start (expected pid=${WATCH_PID})"
    exit 1
fi
