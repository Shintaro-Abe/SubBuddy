#!/usr/bin/env bash
#
# Mac の LAN IP は再起動・DHCP で変わる。これを毎回の実行で吸収するためのスクリプト。
#   - 現在の LAN IP を検出（デフォルトルートのインターフェース優先 → enX フォールバック）
#     ※ Wi-Fi が en0 以外（Ethernet/Thunderbolt があると en1 等）でも正しく拾える
#   - SubBuddySpike/Shared/Constants.swift の apiBaseURL と比較
#   - 変わっていれば apiBaseURL を更新し、後続に必要な手当て
#     （アプリ再ビルド・再インストール／ショートカットの URL 変更）を案内する
#   - ショートカットは現 IP を埋めた版を e2e/.generated/ に生成（再インポート用）
#
# 使い方（Mac のターミナル / コンテナ外）:
#   cd spikes/ios-screen-time
#   scripts/refresh-ip.sh            # 検出 → 必要なら Constants.swift 更新 → 案内
#   scripts/refresh-ip.sh --check    # 変更せず差分の有無だけ判定（preflight 用）
#
# 終了コード: 0=変更なし / 10=IP 更新あり（要再ビルド）/ 1=エラー
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPIKE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STEERING_DIR="$(cd "${SPIKE_DIR}/../../.steering/20260606-ios-screen-time-spike" 2>/dev/null && pwd || true)"
CONST="${SPIKE_DIR}/SubBuddySpike/Shared/Constants.swift"
PORT="${WEB_PORT:-3000}"

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

# 非 macOS（このコンテナ等）では IP 自動検出はできない。安全に何もしないで抜ける。
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "  ⚠ 非 macOS。IP 自動検出は Mac のみ（このコンテナでは何もしない）。"
  exit 0
fi

# ── LAN IP 検出: デフォルトルートの IF を最優先（Wi-Fi が en0 以外でも拾える） ──
detect_lan_ip() {
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

CUR_IP="$(detect_lan_ip)"
if [[ -z "${CUR_IP}" ]]; then
  echo "  ✗ LAN IP を検出できません（Wi-Fi 未接続？）。Mac で 'ipconfig getifaddr en0' を確認してください。"
  exit 1
fi

[[ -f "${CONST}" ]] || { echo "  ✗ ${CONST} がありません。先に scripts/setup.sh を実行してください。"; exit 1; }

# 現在 Constants.swift に書かれている host を取り出して現 IP と比較する。
OLD_URL="$(grep -oE 'apiBaseURL = "[^"]*"' "${CONST}" | sed -E 's/apiBaseURL = "//; s/"$//')"
OLD_HOST="$(printf '%s' "${OLD_URL}" | sed -E 's#https?://##; s#:.*##')"
NEW_URL="http://${CUR_IP}:${PORT}"

if [[ "${OLD_HOST}" == "${CUR_IP}" ]]; then
  echo "  ✅ LAN IP 変更なし（${CUR_IP}）。Constants.swift・ショートカットの手当ては不要。"
  exit 0
fi

echo "  ⚠ LAN IP が変わりました: ${OLD_HOST:-未設定} → ${CUR_IP}"

if [[ "${CHECK_ONLY}" == "1" ]]; then
  echo "    （--check: ファイルは変更していません。反映するには引数なしで実行）"
  exit 10
fi

# ── Constants.swift の apiBaseURL を更新（awk で安全に置換・インデント保持） ──
tmp="$(mktemp)"
VAL="${NEW_URL}" awk '
  BEGIN { v = ENVIRON["VAL"] }
  $0 ~ /^[[:space:]]*static let apiBaseURL =/ { print "    static let apiBaseURL = \"" v "\""; next }
  { print }
' "${CONST}" > "${tmp}" && mv "${tmp}" "${CONST}"
echo "  ✅ 更新: Constants.swift apiBaseURL = ${NEW_URL}"

# ── ショートカット: 現 IP を埋めた版を生成（再インポート用・gitignore 配下） ──
GEN_DIR="${SPIKE_DIR}/e2e/.generated"
TMPL="${STEERING_DIR}/subbuddy-usage.template.shortcut"
if [[ -n "${STEERING_DIR}" && -f "${TMPL}" ]]; then
  mkdir -p "${GEN_DIR}"
  OUT="${GEN_DIR}/subbuddy-usage.shortcut"
  # テンプレ内のプレースホルダは XML エスケープ済み(&lt;MAC_IP&gt;)。素の <MAC_IP> も一応置換。
  sed -e "s/&lt;MAC_IP&gt;/${CUR_IP}/g" -e "s/<MAC_IP>/${CUR_IP}/g" "${TMPL}" > "${OUT}"
  echo "  ✅ 生成: e2e/.generated/subbuddy-usage.shortcut（現 IP を埋め込み済み）"
fi

cat <<EOS

────────────────────────────────────────────────────────
 IP が変わったので、次の手当てが必要です（IP の焼き込みは 2 箇所）
────────────────────────────────────────────────────────
 1) iPhone アプリ（SubBuddySpike）の再ビルド・再インストール
    └ apiBaseURL はアプリにコンパイルされるため、ビルドし直さないと
      古い IP のまま送信します。
      → scripts/run-e2e-real-device.sh を「SKIP_BUILD なし」で実行
        （SKIP_BUILD=1 だと再インストールされず IP が反映されません）

 2) iPhone のショートカットの送信先 URL を変更
    └ ショートカットにも IP が焼き込まれています。次のどちらか:
      A. ショートカット App で対象を開き、「URL の内容を取得」アクションの
         http://<旧IP>:3000/api/usage/daily を
         http://${CUR_IP}:3000/api/usage/daily に書き換える
      B. 生成済みの e2e/.generated/subbuddy-usage.shortcut を
         iPhone へ AirDrop / Files で取り込み直す

 3) 動作確認
    iPhone(Wi-Fi) の Safari で  http://${CUR_IP}:3000  が開ければ到達 OK。
────────────────────────────────────────────────────────
EOS
exit 10
