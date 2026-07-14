import DeviceActivity
import Foundation
import os

private let logger = Logger(subsystem: "com.subbuddy.app.monitor", category: "Monitor")

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        let today = AppConstants.localDateString()
        let bucket = Self.bucketFromEventId(event.rawValue)

        let store = SharedStore()
        guard store.isAvailable else {
            logger.error("App Group container is unavailable")
            return
        }

        store.upsert(
            activityId: activity.rawValue,
            eventId: event.rawValue,
            date: today,
            bucket: bucket
        )
    }

    override func intervalDidStart(for activity: DeviceActivityName) {
        logger.info("interval started: \(activity.rawValue)")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        logger.info("interval ended: \(activity.rawValue)")
    }

    private static func bucketFromEventId(_ eventId: String) -> UsageBucket {
        let parts = eventId.split(separator: "_")
        guard let last = parts.last,
              last.hasSuffix("m"),
              let minutes = Int(last.dropLast()) else {
            return .none
        }

        return UsageBucket.fromMinutes(minutes)
    }
}
