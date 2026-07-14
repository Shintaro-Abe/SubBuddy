import Foundation
import os

private let logger = Logger(subsystem: "com.subbuddy.app", category: "SharedStore")

struct UsageRecord: Codable, Equatable {
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

    init(fileURL: URL) {
        self.fileURL = fileURL
    }

    func upsert(activityId: String, eventId: String, date: String, bucket: UsageBucket) {
        guard fileURL != nil else {
            logger.error("upsert failed: App Group container unavailable")
            return
        }

        do {
            try mutate { records in
                if let index = records.firstIndex(where: {
                    $0.activityId == activityId && $0.date == date
                }) {
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
            }
        } catch {
            logger.error("upsert error: \(error.localizedDescription)")
        }
    }

    func readAll() -> [UsageRecord] {
        guard let fileURL else { return [] }
        let coordinator = NSFileCoordinator(filePresenter: nil)
        var coordinationError: NSError?
        var accessorError: Error?
        var records: [UsageRecord] = []
        coordinator.coordinate(readingItemAt: fileURL, options: [], error: &coordinationError) {
            coordinatedURL in
            do {
                records = try Self.decodeRecords(at: coordinatedURL)
            } catch {
                accessorError = error
            }
        }
        if let error = coordinationError.map({ $0 as Error }) ?? accessorError {
            logger.error("read error: \(error.localizedDescription)")
            return []
        }
        return records
    }

    /// 送信時に読み取ったものと同一のレコードだけを削除する。
    /// 送信中にExtensionが更新したレコードは一致しないため、次回同期用に残る。
    func removeAcknowledged(_ acknowledgedRecords: [UsageRecord]) {
        guard !acknowledgedRecords.isEmpty else { return }
        do {
            try mutate { records in
                records.removeAll { acknowledgedRecords.contains($0) }
            }
        } catch {
            logger.error("remove error: \(error.localizedDescription)")
        }
    }

    private func mutate(_ transform: (inout [UsageRecord]) -> Void) throws {
        guard let fileURL else { return }
        let coordinator = NSFileCoordinator(filePresenter: nil)
        var coordinationError: NSError?
        var accessorError: Error?
        coordinator.coordinate(writingItemAt: fileURL, options: [], error: &coordinationError) {
            coordinatedURL in
            do {
                var records = try Self.decodeRecords(at: coordinatedURL)
                transform(&records)
                let data = try JSONEncoder().encode(records)
                try data.write(to: coordinatedURL, options: .atomic)
            } catch {
                accessorError = error
            }
        }
        if let error = coordinationError.map({ $0 as Error }) ?? accessorError {
            throw error
        }
    }

    private static func decodeRecords(at fileURL: URL) throws -> [UsageRecord] {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode([UsageRecord].self, from: data)
    }
}
