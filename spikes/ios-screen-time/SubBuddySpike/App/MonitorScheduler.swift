import DeviceActivity
import FamilyControls
import Foundation

/// 監視の登録・停止を管理する。
/// startMonitoring は同名監視を上書きする（Apple 公式仕様）。
final class MonitorScheduler {

    private let center = DeviceActivityCenter()

    /// 対象アプリに対して閾値監視を登録する（段階2: タスク2-4）
    func startMonitoring(
        activityName: String,
        selection: FamilyActivitySelection
    ) throws {
        let activity = DeviceActivityName(rawValue: activityName)

        // 1日＝midnight to midnight（iPhone 現地時刻基準 = MUST-4）
        let midnight = DateComponents(hour: 0, minute: 0, second: 0)
        let endOfDay = DateComponents(hour: 23, minute: 59, second: 59)

        let schedule = DeviceActivitySchedule(
            intervalStart: midnight,
            intervalEnd: endOfDay,
            repeats: true
        )

        // デバッグ: 選択内容を確認
        print("[Scheduler] applicationTokens count: \(selection.applicationTokens.count)")
        print("[Scheduler] categoryTokens count: \(selection.categoryTokens.count)")
        print("[Scheduler] webDomainTokens count: \(selection.webDomainTokens.count)")

        // アプリ単体 + カテゴリの両方を対象にする（カテゴリ選択でも動くように）
        let apps = selection.applicationTokens
        let categories = selection.categoryTokens

        if apps.isEmpty && categories.isEmpty {
            print("[Scheduler] WARNING: no applications or categories selected")
        }

        // 閾値イベントを生成（15m, 30m, 60m, 120m）
        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
        for minutes in SpikeConstants.thresholdMinutes {
            let eventName = DeviceActivityEvent.Name(rawValue: "\(activityName)_\(minutes)m")
            events[eventName] = DeviceActivityEvent(
                applications: apps,
                categories: categories,
                threshold: DateComponents(minute: minutes),
                includesPastActivity: true
            )
        }

        try center.startMonitoring(activity, during: schedule, events: events)
        print("[Scheduler] started monitoring: \(activityName) with \(events.count) thresholds")
    }

    func stopMonitoring(activityName: String) {
        let activity = DeviceActivityName(rawValue: activityName)
        center.stopMonitoring([activity])
        print("[Scheduler] stopped monitoring: \(activityName)")
    }

    func stopAll() {
        center.stopMonitoring()
        print("[Scheduler] stopped all monitoring")
    }

    /// 現在監視中のアクティビティ名一覧
    var activeActivities: [String] {
        center.activities.map(\.rawValue)
    }
}
