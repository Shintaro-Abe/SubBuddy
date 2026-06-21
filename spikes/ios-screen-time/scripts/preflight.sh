#!/usr/bin/env bash
#
# 実機 E2E 前提チェック（ビルドはしない・高速）。
#   run-e2e-real-device.sh から source される。単体でも実行可:
#     cd spikes/ios-screen-time && scripts/preflight.sh
#   長いビルドに入る前に「Mac の準備ができているか」を数秒で確認する。
set -euo pipefail

# ── 必須環境変数 ──
: "${IOS_DEVICE_UDID:?IOS_DEVICE_UDID が未設定です（実機の UDID）}"
: "${IOS_BUNDLE_ID:?IOS_BUNDLE_ID が未設定です（例 com.yourname.SubBuddySpike）}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID が未設定です（Apple Developer Team ID）}"

# ── 既定値（後続ステップでも使うので export） ──
export IOS_APP_GROUP="${IOS_APP_GROUP:-group.${IOS_BUNDLE_ID}}"
export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
export IOS_TEST_SUBSCRIPTION_ID="${IOS_TEST_SUBSCRIPTION_ID:-}"

PF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WARN=0

ok()   { echo "  ✅ $1"; }
warn() { echo "  ⚠ $1"; WARN=$((WARN + 1)); }
die()  { echo "  ✗ $1"; exit 1; }

echo "▶ 前提チェック"

# ── 1) macOS か（コンテナ内では失敗させる） ──
if [[ "$(uname -s)" != "Darwin" ]]; then
  die "macOS で実行してください（現在: $(uname -s)）。Dev Container 内では xcodebuild / 実機接続ができません。"
fi
ok "macOS"

# ── 2) ツール ──
need() { command -v "$1" >/dev/null 2>&1 && ok "$1" || die "'$1' が見つかりません。${2}"; }
need xcodegen "brew install xcodegen"
need xcodebuild "Xcode と Command Line Tools を入れてください"
need xcrun "Xcode Command Line Tools が必要です"
need node "Node.js を入れてください"
need npm "Node.js を入れてください"
need appium "npm i -g appium && appium driver install xcuitest"

# xcuitest ドライバの導入確認
if appium driver list --installed 2>&1 | grep -qi xcuitest; then
  ok "appium xcuitest driver"
else
  warn "appium の xcuitest ドライバが未導入の可能性。'appium driver install xcuitest' を実行"
fi

# ── 3) 実機接続 ──
# IOS_DEVICE_UDID はハードウェア UDID。devicectl は CoreDevice UUID 表示で照合できないため
# xctrace（ハードウェア UDID を表示）で確認する。
if xcrun xctrace list devices 2>/dev/null | grep -q "${IOS_DEVICE_UDID}"; then
  ok "実機接続 (${IOS_DEVICE_UDID})"
else
  warn "実機 ${IOS_DEVICE_UDID} が未検出。USB 接続・ロック解除・信頼・Developer Mode を確認（xcrun xctrace list devices で確認）"
fi

# ── 4) Constants.swift と App Group の整合 ──
CONST="${PF_DIR}/SubBuddySpike/Shared/Constants.swift"
if [[ -f "${CONST}" ]]; then
  if grep -q "appGroupID = \"${IOS_APP_GROUP}\"" "${CONST}"; then
    ok "App Group 整合 (${IOS_APP_GROUP})"
  else
    warn "Constants.swift の appGroupID が ${IOS_APP_GROUP} と不一致の可能性（不一致だと本体↔拡張でデータ共有されない）"
  fi
else
  warn "${CONST} がありません。'cp Constants.swift.example Constants.swift' して実値を設定"
fi

# ── 4b) LAN IP ドリフト（Mac 再起動・DHCP で IP が変わると iPhone から届かない） ──
# refresh-ip.sh --check は 0=一致 / 10=不一致 / 1=検出失敗 を返す（ファイルは変更しない）。
if "${PF_DIR}/scripts/refresh-ip.sh" --check >/dev/null 2>&1; then
  ok "LAN IP 整合（Constants.swift の apiBaseURL が現在の IP と一致）"
else
  rc=$?
  if [[ ${rc} -eq 10 ]]; then
    warn "Constants.swift の apiBaseURL が現在の LAN IP と不一致。'scripts/refresh-ip.sh' で更新→アプリ再ビルド＋ショートカット URL を変更（IP は再起動で変わる）"
  else
    warn "LAN IP を検出できません（Wi-Fi 未接続？）。'scripts/refresh-ip.sh' で確認"
  fi
fi

# ── 5) Web 管理画面の到達性 ──
if curl -sf -o /dev/null --max-time 5 "${WEB_BASE_URL}/subscriptions"; then
  ok "Web 到達 (${WEB_BASE_URL})"
else
  warn "Web (${WEB_BASE_URL}) に到達できません。apps/web を 0.0.0.0:3000 で起動し、iPhone Safari でも開けるか確認"
fi

# ── 6) 対象サブスク ID が送信先 DB に実在するか ──
if [[ -n "${IOS_TEST_SUBSCRIPTION_ID}" ]]; then
  if curl -sf -o /dev/null --max-time 5 "${WEB_BASE_URL}/subscriptions/${IOS_TEST_SUBSCRIPTION_ID}"; then
    ok "対象サブスク存在 (${IOS_TEST_SUBSCRIPTION_ID})"
  else
    warn "サブスク詳細が開けません。IOS_TEST_SUBSCRIPTION_ID が送信先 DB に実在するか確認（実在しないと送信が HTTP 500）"
  fi
else
  warn "IOS_TEST_SUBSCRIPTION_ID 未指定。Web 確認はトップ表示のみになる"
fi

echo "▶ 前提チェック完了（警告 ${WARN} 件）"
