import Foundation

enum SpikeConstants {
    // ── ユーザーが自分の環境に合わせて変更する値（実 IP・トークンはコミットしないこと） ──
    static let appGroupID = "group.com.yourname.SubBuddySpike"
    // ⚠️ http で Mac の LAN IP（127.0.0.1 不可）。devcontainer の場合は VS Code の
    //    remote.localPortHost: allInterfaces で 0.0.0.0 公開すること（README Step 7②）。
    static let apiBaseURL = "http://192.168.1.100:3000"
    // apps/web/.env の USAGE_SYNC_TOKEN と一致させる（不一致は 401）。
    static let syncToken = "YOUR_USAGE_SYNC_TOKEN"

    // ── 固定値 ──
    static let usageEndpoint = "/api/usage/daily"
    static let source = "ios_device_activity"

    // DeviceActivity の閾値（分）— MVP は 15 分以上から
    static let thresholdMinutes: [Int] = [15, 30, 60, 120]
}
