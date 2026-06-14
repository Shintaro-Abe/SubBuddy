import Foundation
import os

private let logger = Logger(subsystem: "com.subbuddy.SubBuddySpike", category: "SharedStore")

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

    /// App Group コンテナが利用可能かどうか
    var isAvailable: Bool { fileURL != nil }

    init() {
        if let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SpikeConstants.appGroupID
        ) {
            fileURL = container.appendingPathComponent("usage_records.json")
            logger.info("App Group container: \(container.path)")
        } else {
            fileURL = nil
            logger.error("App Group container is nil! Check appGroupID: \(SpikeConstants.appGroupID)")
        }
    }

    func upsert(activityId: String, eventId: String, date: String, bucket: UsageBucket) {
        guard let fileURL else {
            logger.error("upsert failed: App Group container unavailable")
            return
        }
        var records = readAll()
        if let idx = records.firstIndex(where: { $0.activityId == activityId && $0.date == date }) {
            if bucket > records[idx].bucket {
                let seq = records[idx].sequence + 1
                records[idx] = UsageRecord(
                    activityId: activityId, eventId: eventId,
                    date: date, bucket: bucket,
                    generatedAt: Date(), sequence: seq
                )
                logger.info("upsert: updated \(activityId) \(date) -> \(bucket.wireValue) seq=\(seq)")
            } else {
                logger.info("upsert: skipped (existing bucket >= new)")
            }
        } else {
            records.append(UsageRecord(
                activityId: activityId, eventId: eventId,
                date: date, bucket: bucket,
                generatedAt: Date(), sequence: 1
            ))
            logger.info("upsert: inserted \(activityId) \(date) \(bucket.wireValue)")
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
            logger.info("write: \(records.count) records saved")
        } catch {
            logger.error("write error: \(error.localizedDescription)")
        }
    }
}
