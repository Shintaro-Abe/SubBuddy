#!/bin/bash
# post_start.sh: コンテナ起動のたびに実行されるスクリプト (Codex CLI 版)。
#
# Claude Code 固有の要素 (cron デーモン起動 / Claude OAuth トークン watcher) は
# Codex 移行に伴い除去した。
# PostgreSQL は手動運用。必要時に `sudo service postgresql start` を実行する。

set -uo pipefail

echo "[post-start] $(date '+%Y-%m-%d %H:%M:%S') container started (Codex CLI 環境)"
