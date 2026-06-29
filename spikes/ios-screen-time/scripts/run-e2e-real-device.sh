#!/usr/bin/env bash
#
# 実機 E2E 一括実行スクリプト（MacBook 上で実行）。
#   GUI を使わず: XcodeGen で .xcodeproj 生成 → xcodebuild でビルド →
#   devicectl で実機インストール → Appium 起動 → Node(E2E) 実行。
#
# 使い方:
#   cd spikes/ios-screen-time
#   IOS_DEVICE_UDID=... IOS_BUNDLE_ID=... APPLE_TEAM_ID=... \
#     IOS_TEST_SUBSCRIPTION_ID=... WEB_BASE_URL=http://<MacのLAN IP>:3000 \
#     scripts/run-e2e-real-device.sh
#
# 事前準備（手動・初回のみ。詳細は README の「自動 E2E（実機）」）:
#   - iPhone の Developer Mode 有効化 / このコンピュータを信頼
#   - Screen Time 許可と対象アプリ選択をアプリ上で 1 回手動で実施
#   - brew install xcodegen / npm i -g appium / appium driver install xcuitest
set -euo pipefail

# ── パス解決（このスクリプトの 1 つ上が spike ルート） ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPIKE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SPIKE_DIR}"

# ── 環境変数ファイル（あれば読み込む。毎回インライン指定しなくてよい） ──
ENV_FILE="${SPIKE_DIR}/e2e/.env.local"
if [[ -f "${ENV_FILE}" ]]; then
  echo "▶ 環境変数を読み込み: ${ENV_FILE}"
  set -a; source "${ENV_FILE}"; set +a
fi

# ── LAN IP を現在値へ同期（Mac 再起動・DHCP で変わるため）。 ──
# Constants.swift の apiBaseURL を現 IP に更新してからビルドする。
# 終了コード 10 = IP が変わった（要再ビルド）/ 1 = 検出失敗。SKIP_IP_REFRESH=1 で無効化。
if [[ "${SKIP_IP_REFRESH:-0}" != "1" ]]; then
  set +e
  "${SCRIPT_DIR}/refresh-ip.sh"
  IP_RC=$?
  set -e
  if [[ ${IP_RC} -eq 1 ]]; then
    echo "✗ LAN IP の検出に失敗しました。Wi-Fi 接続を確認してください。"
    exit 1
  fi
  if [[ ${IP_RC} -eq 10 && "${SKIP_BUILD:-0}" == "1" ]]; then
    echo "⚠ LAN IP が変わったのに SKIP_BUILD=1 です。再インストールしないと旧 IP のまま送信します。"
    echo "  → SKIP_BUILD を外して実行してください（今回は続行しますが結果に注意）。"
  fi
fi

# ── 前提チェック（必須env・ツール・実機・Web到達。失敗時はここで停止） ──
# source して既定値（IOS_APP_GROUP 等）を後続へ引き継ぐ
if [[ "${SKIP_PREFLIGHT:-0}" != "1" ]]; then
  source "${SCRIPT_DIR}/preflight.sh"
fi

APPIUM_PORT="${APPIUM_PORT:-4723}"
CONFIGURATION="${CONFIGURATION:-Debug}"

# ── アーティファクト出力先（タイムスタンプ） ──
TS="$(date +%Y%m%d-%H%M%S)"
export E2E_ARTIFACTS_DIR="${SPIKE_DIR}/e2e/artifacts/${TS}"
mkdir -p "${E2E_ARTIFACTS_DIR}"
APPIUM_LOG="${E2E_ARTIFACTS_DIR}/appium.log"

echo "▶ アーティファクト: ${E2E_ARTIFACTS_DIR}"

# ── 後始末（Appium を確実に止める） ──
APPIUM_PID=""
cleanup() {
  if [[ -n "${APPIUM_PID}" ]] && kill -0 "${APPIUM_PID}" 2>/dev/null; then
    kill "${APPIUM_PID}" 2>/dev/null || true
    wait "${APPIUM_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# SKIP_BUILD=1 のときは生成/ビルド/インストール（1〜3）を省略し、
# 既にインストール済みのアプリに対して Appium だけ実行する（再インストールを避けて
# Screen Time 認可を保持したいときや、反復実行を速くしたいときに使う）。
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  echo "▶ [1-3/5] 生成/ビルド/インストールをスキップ（SKIP_BUILD=1・インストール済みアプリを使用）"
else
  # ── 1) XcodeGen で .xcodeproj を生成（env を spec に展開） ──
  echo "▶ [1/5] xcodegen generate"
  xcodegen generate

  # iCloud/Desktop 同期フォルダ等が付与する拡張属性（resource fork / Finder info）は
  # codesign を失敗させる（"resource fork, Finder information, or similar detritus not allowed"）。
  # ソースと生成プロジェクトから除去しておく。
  xattr -cr "${SPIKE_DIR}/SubBuddySpike" "${SPIKE_DIR}/MonitorExtension" \
            "${SPIKE_DIR}/SubBuddySpike.xcodeproj" 2>/dev/null || true

  # ── 2) xcodebuild でビルド（GUI 不使用・自動署名更新を許可） ──
  echo "▶ [2/5] xcodebuild build"
  # DerivedData は同期フォルダ外に置く（iCloud が付ける拡張属性で codesign が失敗するのを防ぐ）。
  # 別の場所を使いたい場合は SUBBUDDY_DERIVED_DATA で上書き可。
  DERIVED="${SUBBUDDY_DERIVED_DATA:-${TMPDIR:-/tmp}/subbuddy-spike-derived}"
  xcodebuild \
    -project SubBuddySpike.xcodeproj \
    -scheme SubBuddySpike \
    -configuration "${CONFIGURATION}" \
    -destination "id=${IOS_DEVICE_UDID}" \
    -derivedDataPath "${DERIVED}" \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="${APPLE_TEAM_ID}" \
    build | tee "${E2E_ARTIFACTS_DIR}/xcodebuild.log"

  APP_PATH="${DERIVED}/Build/Products/${CONFIGURATION}-iphoneos/SubBuddySpike.app"
  [[ -d "${APP_PATH}" ]] || { echo "✗ ビルド成果物が見つかりません: ${APP_PATH}"; exit 1; }

  # ── 3) 実機へインストール ──
  echo "▶ [3/5] devicectl install"
  xcrun devicectl device install app --device "${IOS_DEVICE_UDID}" "${APP_PATH}" \
    | tee "${E2E_ARTIFACTS_DIR}/install.log"
fi

# ── 4) Appium サーバ起動（ログをアーティファクトへ） ──
# ポートが既に使用中（VS Code のポート転送等）だと Appium が応答できないため、空きポートを探す。
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
if port_busy "${APPIUM_PORT}"; then
  echo "⚠ ポート ${APPIUM_PORT} は使用中（VS Code のポート転送等）。空きを探します"
  for p in $(seq "$((APPIUM_PORT + 1))" "$((APPIUM_PORT + 20))"); do
    if ! port_busy "$p"; then APPIUM_PORT="$p"; break; fi
  done
fi
export APPIUM_PORT
echo "▶ [4/5] appium 起動（port: ${APPIUM_PORT} / log: ${APPIUM_LOG}）"
appium --port "${APPIUM_PORT}" --log-timestamp --log "${APPIUM_LOG}" >/dev/null 2>&1 &
APPIUM_PID=$!

# 起動待ち（/status が返るまで最大 ~60s）。
# curl には必ずタイムアウトを付ける（無いと「接続は受けるが無応答」で永久ハングする）。
APPIUM_READY=0
for i in $(seq 1 60); do
  if curl -sf --connect-timeout 2 --max-time 3 "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null 2>&1; then
    APPIUM_READY=1; break
  fi
  if ! kill -0 "${APPIUM_PID}" 2>/dev/null; then echo "✗ Appium が起動直後に終了しました。${APPIUM_LOG} を確認"; exit 1; fi
  sleep 1
done
[[ "${APPIUM_READY}" == "1" ]] || { echo "✗ Appium /status に到達できません（${APPIUM_LOG} を確認）"; exit 1; }

# ── 5) E2E 実行（Node: Appium ネイティブ + Playwright Web） ──
echo "▶ [5/5] E2E 実行"
pushd "${SPIKE_DIR}/e2e" >/dev/null
[[ -d node_modules ]] || npm install
# Playwright のブラウザ（chromium）が無ければ取得
npx playwright install chromium >/dev/null 2>&1 || true

export APPIUM_PORT
set +e
node real-device.test.mjs
E2E_EXIT=$?
set -e
popd >/dev/null

echo ""
if [[ ${E2E_EXIT} -eq 0 ]]; then
  echo "✅ E2E 成功"
else
  echo "❌ E2E 失敗（exit ${E2E_EXIT}）"
  echo "   アーティファクト: ${E2E_ARTIFACTS_DIR}"
  echo "   - appium.log / xcodebuild.log / install.log"
  echo "   - appium-failure.png（取得できた場合）"
  echo "   - playwright-trace.zip → npx playwright show-trace \"${E2E_ARTIFACTS_DIR}/playwright-trace.zip\""
fi
exit ${E2E_EXIT}
