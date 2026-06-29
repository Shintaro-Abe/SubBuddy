// E2E 設定: 環境変数の読み取りと検証、アーティファクト出力先の決定。
// run-e2e-real-device.sh から渡される値を一元化する。

function required(name) {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`環境変数 ${name} が未設定です。run-e2e-real-device.sh から起動してください。`);
  }
  return v.trim();
}

export const config = {
  // 実機・アプリ
  udid: required("IOS_DEVICE_UDID"),
  bundleId: required("IOS_BUNDLE_ID"),
  teamId: required("APPLE_TEAM_ID"),

  // Web 管理画面（Mac 上で稼働）
  webBaseUrl: (process.env.WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, ""),
  // Web 側で健全性を確認する対象サブスク ID（アプリが送信先にする実在 ID と同じ）
  subscriptionId: process.env.IOS_TEST_SUBSCRIPTION_ID || "",

  // Appium サーバ
  appiumHost: process.env.APPIUM_HOST || "127.0.0.1",
  appiumPort: Number(process.env.APPIUM_PORT || 4723),
  appiumPath: process.env.APPIUM_PATH || "/",

  // 一度きりの OS シート（Screen Time 許可・対象アプリ選択）は既定で自動操作しない。
  // 事前に手動で 1 回済ませる前提（README 参照）。SKIP_SYSTEM_UI=false で挑戦する。
  skipSystemUi: (process.env.SKIP_SYSTEM_UI || "true").toLowerCase() !== "false",

  // アーティファクト出力先（シェルが作成して渡す。無ければカレントに作る）
  artifactsDir: process.env.E2E_ARTIFACTS_DIR || "./artifacts/local",

  // タイムアウト（ミリ秒）
  appiumWaitMs: Number(process.env.APPIUM_ELEMENT_WAIT_MS || 20000),
  webWaitMs: Number(process.env.WEB_WAIT_MS || 20000),
};

// WDA のバンドル ID。既定の com.facebook.WebDriverAgentRunner は自分のチームで
// 登録・署名できず xcodebuild code 65 になりやすい。自分のチーム配下の一意 ID にする。
// 例: com.subbuddy.SubBuddySpike -> com.subbuddy.WebDriverAgentRunner
function wdaBundleId() {
  if (process.env.WDA_BUNDLE_ID) return process.env.WDA_BUNDLE_ID;
  const parts = config.bundleId.split(".");
  parts.pop();
  return [...parts, "WebDriverAgentRunner"].join(".");
}

export function appiumCapabilities() {
  return {
    platformName: "iOS",
    "appium:automationName": "XCUITest",
    "appium:udid": config.udid,
    "appium:bundleId": config.bundleId,
    // WebDriverAgent を実機向けに自動署名するためのチーム
    "appium:xcodeOrgId": config.teamId,
    "appium:xcodeSigningId": "Apple Development",
    // WDA を自分のチームで署名できる一意のバンドル ID に（code 65 対策）
    "appium:updatedWDABundleId": wdaBundleId(),
    // WDA ビルド時に -allowProvisioningUpdates を付与し、プロファイル自動生成＋端末登録を許可
    // （"No profiles for ...xctrunner / Automatic signing is disabled" 対策）。
    "appium:allowProvisioningDeviceRegistration": true,
    // アプリは事前にインストール済み（シェルが devicectl で入れる）。再インストールしない。
    "appium:noReset": true,
    "appium:newCommandTimeout": 240,
    "appium:wdaLaunchTimeout": 240000,
    "appium:showXcodeLog": true,
  };
}
