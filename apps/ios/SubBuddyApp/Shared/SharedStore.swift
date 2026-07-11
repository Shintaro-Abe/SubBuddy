import Foundation
import os

private let logger = Logger(subsystem: "com.subbuddy.app", category: "SharedStore")

struct UsageRecord: Codable {
    let activityId: String
    let eventId: String
    let date: String
    let bucket: UsageBucket
    let generatedAt: Date
    let sequence: Int
}

final class SharedStore {
    private let fileURL: URL?

    var isAvailable: Bool {
        fileURL != nil
    }

    init() {
        if let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: AppConstants.appGroupID
        ) {
            fileURL = container.appendingPathComponent(AppConstants.usageRecordFileName)
        } else {
            fileURL = nil
            logger.error("App Group container is unavailable")
        }
    }

    func upsert(activityId: String, eventId: String, date: String, bucket: UsageBucket) {
        guard fileURL != nil else {
            logger.error("upsert failed: App Group container unavailable")
            return
        }

        var records = readAll()
        if let index = records.firstIndex(where: { $0.activityId == activityId && $0.date == date }) {
            guard bucket > records[index].bucket else { return }
            let sequence = records[index].sequence + 1
            records[index] = UsageRecord(
                activityId: activityId,
                eventId: eventId,
                date: date,
                bucket: bucket,
                generatedAt: Date(),
                sequence: sequence
            )
        } else {
            records.append(UsageRecord(
                activityId: activityId,
                eventId: eventId,
                date: date,
                bucket: bucket,
                generatedAt: Date(),
                sequence: 1
            ))
        }

        write(records)
    }

    func readAll() -> [UsageRecord] {
        guard let fileURL else { return [] }
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }

        do {
            let data = try Data(contentsOf: fileURL)
            return try JSONDecoder().decode([UsageRecord].self, from: data)
        } catch {
            logger.error("read error: \(error.localizedDescription)")
            return []
        }
    }

    func remove(activityId: String, date: String) {
        guard fileURL != nil else { return }
        var records = readAll()
        records.removeAll { $0.activityId == activityId && $0.date == date }
        write(records)
    }

    private func write(_ records: [UsageRecord]) {
        guard let fileURL else { return }

        do {
            let data = try JSONEncoder().encode(records)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            logger.error("write error: \(error.localizedDescription)")
        }
    }
}
