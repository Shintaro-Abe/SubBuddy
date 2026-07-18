import DeviceActivity
import FamilyControls
import Foundation

protocol MonitoringScheduling {
    func startMonitoring(activityName: String, selection: FamilyActivitySelection) throws
    func stopMonitoring(activityName: String)
    var activeActivities: [String] { get }
}

final class MonitorScheduler: MonitoringScheduling {
    private let center = DeviceActivityCenter()

    func startMonitoring(activityName: String, selection: FamilyActivitySelection) throws {
        let activity = DeviceActivityName(rawValue: activityName)
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0, second: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59, second: 59),
            repeats: true
        )

        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
        for minutes in AppConstants.thresholdMinutes {
            let eventName = DeviceActivityEvent.Name(rawValue: "\(activityName)_\(minutes)m")
            events[eventName] = DeviceActivityEvent(
                applications: selection.applicationTokens,
                categories: selection.categoryTokens,
                threshold: DateComponents(minute: minutes),
                includesPastActivity: true
            )
        }

        try center.startMonitoring(activity, during: schedule, events: events)
    }

    func stopMonitoring(activityName: String) {
        center.stopMonitoring([DeviceActivityName(rawValue: activityName)])
    }

    var activeActivities: [String] {
        center.activities.map(\.rawValue)
    }
}
