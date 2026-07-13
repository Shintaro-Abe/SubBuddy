import FamilyControls
import Foundation
import os

private let logger = Logger(subsystem: "com.subbuddy.app", category: "MappingStore")

struct SubscriptionMapping: Codable {
    let subscriptionId: String
    let activityName: String
    let selection: Data
}

final class MappingStore {
    private let fileURL: URL?

    init() {
        if let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: AppConstants.appGroupID
        ) {
            fileURL = container.appendingPathComponent(AppConstants.subscriptionMappingFileName)
        } else {
            fileURL = nil
            logger.error("App Group container is unavailable")
        }
    }

    @discardableResult
    func save(_ mapping: SubscriptionMapping) -> Bool {
        guard fileURL != nil else {
            logger.error("save failed: App Group container unavailable")
            return false
        }

        var all = loadAll()
        all.removeAll { $0.subscriptionId == mapping.subscriptionId }
        all.append(mapping)

        do {
            let data = try JSONEncoder().encode(all)
            try write(data)
            return true
        } catch {
            logger.error("save error: \(error.localizedDescription)")
            return false
        }
    }

    func loadAll() -> [SubscriptionMapping] {
        guard let fileURL else { return [] }
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }

        do {
            let data = try Data(contentsOf: fileURL)
            return try JSONDecoder().decode([SubscriptionMapping].self, from: data)
        } catch {
            logger.error("read error: \(error.localizedDescription)")
            return []
        }
    }

    func activityName(for subscriptionId: String) -> String {
        "sub_\(subscriptionId)"
    }

    func subscriptionId(for activityName: String) -> String? {
        loadAll().first { $0.activityName == activityName }?.subscriptionId
    }

    private func write(_ data: Data) throws {
        guard let fileURL else { return }
        try data.write(to: fileURL, options: .atomic)
    }
}
