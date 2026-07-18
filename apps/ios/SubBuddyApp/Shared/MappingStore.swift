import FamilyControls
import Foundation
import ManagedSettings
import os

private let logger = Logger(subsystem: "com.subbuddy.app", category: "MappingStore")

struct SubscriptionMapping: Codable {
    let subscriptionId: String
    let activityName: String
    let selection: Data
}

protocol SubscriptionMappingStoring {
    func save(_ mapping: SubscriptionMapping) -> Bool
    func mapping(for subscriptionId: String) -> SubscriptionMapping?
    func conflictingSubscriptionId(
        for selection: FamilyActivitySelection,
        excluding subscriptionId: String
    ) -> String?
    func remove(subscriptionId: String) -> Bool
    func subscriptionIDs() -> [String]
    func invalidOrDuplicateSubscriptionIDs() -> [String]
    func activityName(for subscriptionId: String) -> String
    func subscriptionId(for activityName: String) -> String?
}

final class MappingStore: SubscriptionMappingStoring {
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

    init(fileURL: URL) {
        self.fileURL = fileURL
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

    func mapping(for subscriptionId: String) -> SubscriptionMapping? {
        loadAll().first { $0.subscriptionId == subscriptionId }
    }

    func subscriptionIDs() -> [String] {
        loadAll().map(\.subscriptionId)
    }

    func invalidOrDuplicateSubscriptionIDs() -> [String] {
        var claimedApplications = Set<ApplicationToken>()
        var invalidOrDuplicate: [String] = []

        for mapping in loadAll() {
            guard let selection = try? JSONDecoder().decode(
                FamilyActivitySelection.self,
                from: mapping.selection
            ), selection.applicationTokens.count == 1,
              selection.categoryTokens.isEmpty,
              selection.webDomainTokens.isEmpty,
              let token = selection.applicationTokens.first,
              claimedApplications.insert(token).inserted else {
                invalidOrDuplicate.append(mapping.subscriptionId)
                continue
            }
        }
        return invalidOrDuplicate
    }

    func conflictingSubscriptionId(
        for selection: FamilyActivitySelection,
        excluding subscriptionId: String
    ) -> String? {
        guard selection.applicationTokens.count == 1,
              let selectedToken = selection.applicationTokens.first else {
            return nil
        }

        return loadAll().first { mapping in
            guard mapping.subscriptionId != subscriptionId,
                  let savedSelection = try? JSONDecoder().decode(
                      FamilyActivitySelection.self,
                      from: mapping.selection
                  ) else {
                return false
            }
            return savedSelection.applicationTokens.contains(selectedToken)
        }?.subscriptionId
    }

    @discardableResult
    func remove(subscriptionId: String) -> Bool {
        guard fileURL != nil else {
            logger.error("remove failed: App Group container unavailable")
            return false
        }

        var all = loadAll()
        all.removeAll { $0.subscriptionId == subscriptionId }

        do {
            let data = try JSONEncoder().encode(all)
            try write(data)
            return true
        } catch {
            logger.error("remove error: \(error.localizedDescription)")
            return false
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
