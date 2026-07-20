#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen が必要です。Homebrew などでインストールしてください。" >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode のコマンドラインツールが必要です。" >&2
  exit 1
fi

if [[ -z "${SUBBUDDY_API_BASE_URL:-}" ]]; then
  echo "注意: SUBBUDDY_API_BASE_URLが未設定です。Simulator検証は続行しますが、この生成結果では実機からAPIへ接続できません。" >&2
fi

xcodegen generate

log_file="${TMPDIR:-/tmp}/subbuddy-ios-main-ui-build.log"

run_xcodebuild() {
  set +e
  xcodebuild "$@" 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e
  if [[ $status -ne 0 ]]; then
    echo "ビルドまたはテストのエラー:" >&2
    grep -nE '(^|[[:space:]])error:|Testing failed:|failed to launch|preflight checks|request was denied' "$log_file" >&2 || true
    echo "完全なログ: $log_file" >&2
    exit "$status"
  fi
}

run_xcodebuild \
    -project SubBuddy.xcodeproj \
    -scheme SubBuddyApp \
    -sdk iphonesimulator \
    -configuration Debug \
    CODE_SIGNING_ALLOWED=NO \
    build

simulator_id=""
if [[ -n "${SUBBUDDY_IOS_TEST_DESTINATION:-}" ]]; then
  destination="$SUBBUDDY_IOS_TEST_DESTINATION"
  if [[ "$destination" =~ id=([^,]+) ]]; then
    simulator_id="${BASH_REMATCH[1]}"
  fi
else
  available_destinations="$(
    xcodebuild \
      -project SubBuddy.xcodeproj \
      -scheme SubBuddyApp \
      -showdestinations
  )"
  simulator_id="$(
    printf '%s\n' "$available_destinations" | awk '
      /platform:iOS Simulator/ && /OS:/ && /name:iPhone/ {
        line = $0
        sub(/^.*id:/, "", line)
        sub(/,.*/, "", line)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
        print line
        exit
      }
    '
  )"
  if [[ -z "$simulator_id" ]]; then
    simulator_id="$(
      printf '%s\n' "$available_destinations" | awk '
        /platform:iOS Simulator/ && /OS:/ {
          line = $0
          sub(/^.*id:/, "", line)
          sub(/,.*/, "", line)
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
          print line
          exit
        }
      '
    )"
  fi
  if [[ -z "$simulator_id" ]]; then
    echo "利用可能なiOS Simulatorが見つかりません。XcodeでSimulatorを追加してください。" >&2
    exit 1
  fi
  destination="platform=iOS Simulator,id=$simulator_id"
fi

echo "テスト先: $destination"
if [[ -n "$simulator_id" ]]; then
  echo "Simulatorの起動完了を待っています。"
  xcrun simctl boot "$simulator_id" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$simulator_id" -b

  echo "古いSubBuddyだけをSimulatorから削除して入れ直します。"
  xcrun simctl terminate "$simulator_id" com.subbuddy.app >/dev/null 2>&1 || true
  xcrun simctl uninstall "$simulator_id" com.subbuddy.app >/dev/null 2>&1 || true
fi

run_xcodebuild \
    -project SubBuddy.xcodeproj \
    -scheme SubBuddyApp \
    -destination "$destination" \
    CODE_SIGNING_ALLOWED=YES \
    CODE_SIGNING_REQUIRED=YES \
    CODE_SIGN_IDENTITY=- \
    clean test
