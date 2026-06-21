#!/usr/bin/env bash
#
# 初回セットアップ自動化。
#   - e2e/.env.local と Shared/Constants.swift を自動生成（雛形からコピー＋値の自動補完）
#   - 必要値はすべて自動取得（手入力なし）:
#       UDID            … xcrun devicectl list devices
#       LAN IP          … ipconfig getifaddr en0
#       APPLE_TEAM_ID   … 署名証明書の OU
#       サブスク ID     … GET /api/subscriptions
#       USAGE_SYNC_TOKEN… apps/web/.env（値は非表示）
#       IOS_BUNDLE_ID   … 固定既定 com.subbuddy.SubBuddySpike
#   - 自動検出できない値だけ警告を出す（環境変数で上書き可。例: APPLE_TEAM_ID=... scripts/setup.sh）
#   - --run を付けるとそのまま実機 E2E（run-e2e-real-device.sh）まで実行
#
# 使い方（Mac のターミナル / コンテナ外）:
#   cd spikes/ios-screen-time
#   scripts/setup.sh             # 生成のみ（全値を自動取得）
#   scripts/setup.sh --run       # 生成 → preflight → 実機 E2E まで
#   scripts/setup.sh --force     # 既存ファイルを上書きして再生成
#
# 物理的に手動が必要な前提（自動化不可・初回のみ）:
#   iPhone の Developer Mode 有効化 / USB 信頼 / Screen Time 許可・対象アプリ選択
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPIKE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SPIKE_DIR}/../.." && pwd)"
cd "${SPIKE_DIR}"

FORCE=0; RUN=0; ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --run) RUN=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    *) echo "不明な引数: $arg"; exit 1 ;;
  esac
done

IS_MAC=0; [[ "$(uname -s)" == "Darwin" ]] && IS_MAC=1

echo "▶ セットアップ開始（mac=${IS_MAC}・必要値は自動検出）"
if [[ "${IS_MAC}" == "0" ]]; then
  echo "  ⚠ 非 macOS。ファイル生成だけ行う（UDID/IP の自動検出と実行はできない）。"
fi

# ── 小道具 ──
# key=value 形式のファイルを書き換え（無ければ追記）。BSD/GNU sed 差異を避け awk で実装。
# 値は ENVIRON 経由で渡し、awk -v のバックスラッシュ・エスケープ処理を回避する。
set_kv() {
  local f="$1" k="$2" v="$3" tmp
  tmp="$(mktemp)"
  if ! VAL="$v" awk -v k="$k" '
    BEGIN { v = ENVIRON["VAL"]; done = 0 }
    $0 ~ "^"k"=" { print k"="v; done = 1; next }
    { print }
    END { if (!done) print k"="v }
  ' "$f" > "$tmp"; then rm -f "$tmp"; return 1; fi
  mv "$tmp" "$f"
}
# Swift の `static let <name> = "..."` 行の値を置換。
# Swift 文字列リテラル向けのエスケープは bash 側で行う（awk gsub のバックスラッシュ解釈を回避）。
# awk は ENVIRON のエスケープ済み値をそのまま出力するだけ。
set_swift() {
  local f="$1" name="$2" v="$3" tmp
  v="${v//\\/\\\\}"   # まず \ を \\ に
  v="${v//\"/\\\"}"   # 次に " を \" に
  tmp="$(mktemp)"
  if ! VAL="$v" awk -v n="$name" '
    BEGIN { v = ENVIRON["VAL"] }
    $0 ~ ("^[[:space:]]*static let " n " =") { print "    static let " n " = \"" v "\""; next }
    { print }
  ' "$f" > "$tmp"; then rm -f "$tmp"; return 1; fi
  mv "$tmp" "$f"
}
# ── 値の自動検出 ──
# デフォルトルートの IF を最優先（Wi-Fi が en0 以外＝Ethernet/Thunderbolt 併用時 en1 等でも拾える）。
detect_lan_ip() {
  [[ "${IS_MAC}" == "1" ]] || return 0
  local iface ip i
  iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "${iface}" ]]; then
    ip="$(ipconfig getifaddr "${iface}" 2>/dev/null || true)"
    [[ -n "${ip}" ]] && { echo "${ip}"; return; }
  fi
  for i in 0 1 2 3 4 5 6 7 8 9; do
    ip="$(ipconfig getifaddr "en${i}" 2>/dev/null || true)"
    [[ -n "${ip}" ]] && { echo "${ip}"; return; }
  done
}
detect_udid() {
  [[ "${IS_MAC}" == "1" ]] || return 0
  local udid16='[0-9a-f]{8}-[0-9a-f]{16}'
  # Appium / xcodebuild が使うのは「ハードウェア UDID」(8hex-16hex、旧端末は 40 桁 hex)。
  # devicectl の Identifier は CoreDevice UUID(8-4-4-4-12) で別物なので UDID には使わない。
  # xctrace は実機のハードウェア UDID を表示する（Mac 本体・Simulator は 8-4-4-4-12 なので拾われない）。
  xcrun xctrace list devices 2>/dev/null | grep -oiE "${udid16}|[0-9a-f]{40}" | head -n1 || true
}
# 署名証明書の OU = Team ID を取り出す（開発→配布の順で探す）
detect_team_id() {
  [[ "${IS_MAC}" == "1" ]] || return 0
  local subj name
  for name in "Apple Development" "Apple Distribution" "iPhone Developer"; do
    subj="$(security find-certificate -a -c "${name}" -p 2>/dev/null \
            | openssl x509 -noout -subject 2>/dev/null | head -n1)"
    [[ -n "${subj}" ]] || continue
    echo "${subj}" | grep -oE 'OU *= *[A-Z0-9]{10}' | grep -oE '[A-Z0-9]{10}' | head -n1
    return 0
  done
}
# Web から既存サブスクの id を 1 件取得（送信先 DB に実在する ID）。
# 応答は {"items":[{"id":...}]}。jq があれば items[0].id を厳密に、無ければ正規表現で先頭 id を拾う。
fetch_subscription_id() {
  local web="$1" json
  json="$(curl -sf --max-time 5 "${web}/api/subscriptions" 2>/dev/null || true)"
  [[ -n "${json}" ]] || return 0
  if command -v jq >/dev/null 2>&1; then
    echo "${json}" | jq -r '.items[0].id // empty' 2>/dev/null || true
  else
    echo "${json}" | grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]+"' | head -n1 \
      | sed -E 's/.*"id"[[:space:]]*:[[:space:]]*"//; s/"$//' || true
  fi
}
read_sync_token() {
  # apps/web/.env の USAGE_SYNC_TOKEN を読む（ローカルのみ・値は表示しない）
  local envf="${REPO_ROOT}/apps/web/.env"
  [[ -f "${envf}" ]] || return 0
  grep -E '^USAGE_SYNC_TOKEN=' "${envf}" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

LAN_IP="$(detect_lan_ip)"
# WEB_BASE_URL は Mac 側ツール（curl 取得・Playwright）が使うので localhost が堅牢。
# iPhone が使う送信先は Constants.swift の apiBaseURL（= LAN IP）側で別に設定する。
WEB_DEFAULT="http://127.0.0.1:3000"

# すべて自動: 環境変数があれば優先、無ければ自動検出、それも無ければ既定/プレースホルダ。
UDID="${IOS_DEVICE_UDID:-$(detect_udid)}";          UDID="${UDID:-00008110-XXXXXXXXXXXXXXXX}"
BUNDLE="${IOS_BUNDLE_ID:-com.subbuddy.SubBuddySpike}"   # 固定既定（Team 内で一意なら任意で可）
TEAM="${APPLE_TEAM_ID:-$(detect_team_id)}";         TEAM="${TEAM:-ABCDE12345}"
WEB_URL="${WEB_BASE_URL:-$WEB_DEFAULT}"
SUB_ID="${IOS_TEST_SUBSCRIPTION_ID:-$(fetch_subscription_id "${WEB_URL}")}"
APP_GROUP="${IOS_APP_GROUP:-group.${BUNDLE}}"

# ── 1) e2e/.env.local 生成 ──
ENV_LOCAL="${SPIKE_DIR}/e2e/.env.local"
if [[ -f "${ENV_LOCAL}" && "${FORCE}" == "0" ]]; then
  echo "  ✓ ${ENV_LOCAL} は既存（--force で上書き）"
else
  cp "${SPIKE_DIR}/e2e/.env.example" "${ENV_LOCAL}"
  set_kv "${ENV_LOCAL}" IOS_DEVICE_UDID "${UDID}"
  set_kv "${ENV_LOCAL}" IOS_BUNDLE_ID "${BUNDLE}"
  set_kv "${ENV_LOCAL}" APPLE_TEAM_ID "${TEAM}"
  set_kv "${ENV_LOCAL}" WEB_BASE_URL "${WEB_URL}"
  set_kv "${ENV_LOCAL}" IOS_TEST_SUBSCRIPTION_ID "${SUB_ID}"
  echo "  ✅ 生成: e2e/.env.local"
fi

# ── 2) Shared/Constants.swift 生成 ──
CONST="${SPIKE_DIR}/SubBuddySpike/Shared/Constants.swift"
if [[ -f "${CONST}" && "${FORCE}" == "0" ]]; then
  echo "  ✓ Constants.swift は既存（--force で上書き）"
else
  cp "${SPIKE_DIR}/SubBuddySpike/Shared/Constants.swift.example" "${CONST}"
  set_swift "${CONST}" appGroupID "${APP_GROUP}"
  [[ -n "${LAN_IP}" ]] && set_swift "${CONST}" apiBaseURL "http://${LAN_IP}:3000"
  TOKEN="$(read_sync_token)"
  if [[ -n "${TOKEN}" ]]; then
    set_swift "${CONST}" syncToken "${TOKEN}"
    echo "  ✅ 生成: Constants.swift（syncToken は apps/web/.env から設定・値は非表示）"
  else
    echo "  ✅ 生成: Constants.swift（⚠ syncToken は雛形のまま。apps/web/.env が無い／未設定）"
  fi
fi

# ── 検出結果サマリ（秘匿値は出さない） ──
echo "▶ 設定値: UDID=${UDID} BUNDLE=${BUNDLE} TEAM=${TEAM} WEB=${WEB_URL} APP_GROUP=${APP_GROUP}"

# 自動検出できなかった値だけ警告（必要ならその行を直すか環境変数で渡す）
[[ "${UDID}" == 00008110-XXXX* ]] && echo "  ⚠ UDID 未検出。iPhone を USB 接続・ロック解除・信頼してから再実行、または IOS_DEVICE_UDID を指定"
[[ "${TEAM}" == "ABCDE12345" ]]   && echo "  ⚠ Team ID 未検出。Xcode で一度実機ビルドして署名証明書を作るか、APPLE_TEAM_ID を指定"
[[ -z "${SUB_ID}" ]]              && echo "  ⚠ サブスク ID 未取得。Web 起動後に再実行、または IOS_TEST_SUBSCRIPTION_ID を指定（Web 確認はトップのみ）"
# 署名証明書から自動検出した場合、複数アカウントがあると誤チームを選ぶ恐れがあるため明示を促す
[[ "${IS_MAC}" == "1" && -z "${APPLE_TEAM_ID:-}" && "${TEAM}" != "ABCDE12345" ]] && \
  echo "  ℹ Team ID は署名証明書から自動検出（${TEAM}）。複数アカウントがある場合は APPLE_TEAM_ID=... で明示"
# Constants.swift の apiBaseURL は LAN IP が取れた時だけ更新される
[[ "${IS_MAC}" == "1" && -z "${LAN_IP}" ]] && \
  echo "  ⚠ LAN IP 未取得のため Constants.swift の apiBaseURL が雛形(192.168.1.100)のまま。iPhone 送信先になるので手修正が必要"

# ── 3) 任意: そのまま実機 E2E まで ──
if [[ "${RUN}" == "1" ]]; then
  if [[ "${IS_MAC}" == "0" ]]; then
    echo "  ✗ --run は macOS でのみ可能（実機 E2E はコンテナ内では動かない）"
    exit 1
  fi
  echo "▶ 実機 E2E を実行（run-e2e-real-device.sh）"
  exec "${SCRIPT_DIR}/run-e2e-real-device.sh"
fi

echo "▶ セットアップ完了。実行: scripts/run-e2e-real-device.sh （または scripts/setup.sh --run）"
[[ "${IS_MAC}" == "0" ]] && echo "  ※ このコンテナでは生成のみ。実行は Mac のターミナルで。"
echo "  ※ 物理手順（Developer Mode / USB 信頼 / Screen Time 許可・アプリ選択）は初回だけ手動で。"
