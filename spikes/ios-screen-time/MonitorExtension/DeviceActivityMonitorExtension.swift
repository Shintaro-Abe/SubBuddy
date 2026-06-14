import DeviceActivity
import Foundation
import os

private let logger = Logger(subsystem: "com.subbuddy.SubBuddySpike.MonitorExtension", category: "Monitor")

class DeviceActivityMonitorExtension: DeviceActivityMonitor {

    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        let activityId = activity.rawValue
        let eventId = event.rawValue
        let today = Self.todayString()
        let bucket = Self.bucketFromEventId(eventId)

        logger.info("[Monitor] threshold reached: activity=\(activityId) event=\(eventId) bucket=\(bucket.wireValue)")

        let store = SharedStore()
        guard store.isAvailable else {
            logger.error("[Monitor] App Group container is not available!")
            return
        }
        store.upsert(activityId: activityId, eventId: eventId, date: today, bucket: bucket)
        logger.info("[Monitor] record written successfully")
    }

    override func intervalDidStart(for activity: DeviceActivityName) {
        logger.info("[Monitor] interval started: \(activity.rawValue)")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        logger.info("[Monitor] interval ended: \(activity.rawValue)")
    }

    private static func todayString() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
    }

    private static func bucketFromEventId(_ eventId: String) -> UsageBucket {
        let parts = eventId.split(separator: "_")
        guard let last = parts.last, last.hasSuffix("m"),
              let minutes = Int(last.dropLast()) else {
            return .none
        }
        return UsageBucket.fromMinutes(minutes)
    }
}
