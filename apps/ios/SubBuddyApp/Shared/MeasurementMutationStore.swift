import Foundation
import os

private let mutationLogger = Logger(
    subsystem: "com.subbuddy.app",
    category: "MeasurementMutationStore"
)

struct MeasurementMutation: Codable, Equatable {
    enum Operation: String, Codable {
        case replace
        case unlink
    }

    let subscriptionId: String
    let oldActivityName: String
    let replacementSelection: Data?
    let operation: Operation
}
protocol MeasurementMutationStoring {
    func mutation(for subscriptionId: String) -> MeasurementMutation?
    func pendingSubscriptionIDs() -> Set<String>
    func save(_ mutation: MeasurementMutation) -> Bool
    func remove(subscriptionId: String) -> Bool
}

final class MeasurementMutationStore: MeasurementMutationStoring {
    private let fileURL: URL?

    init() {
        fileURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: AppConstants.appGroupID
        )?.appendingPathComponent(AppConstants.measurementMutationFileName)
        if fileURL == nil {
            mutationLogger.error("App Group container is unavailable")
        }
    }

    init(fileURL: URL) {
        self.fileURL = fileURL
    }

    func mutation(for subscriptionId: String) -> MeasurementMutation? {
        loadAll().first { $0.subscriptionId == subscriptionId }
    }

    func pendingSubscriptionIDs() -> Set<String> {
        Set(loadAll().map(\.subscriptionId))
    }

    @discardableResult
    func save(_ mutation: MeasurementMutation) -> Bool {
        mutate { mutations in
            mutations.removeAll { $0.subscriptionId == mutation.subscriptionId }
            mutations.append(mutation)
        }
    }

    @discardableResult
    func remove(subscriptionId: String) -> Bool {
        mutate { mutations in
            mutations.removeAll { $0.subscriptionId == subscriptionId }
        }
    }

    private func loadAll() -> [MeasurementMutation] {
        guard let fileURL,
              FileManager.default.fileExists(atPath: fileURL.path) else {
            return []
        }
        do {
            return try JSONDecoder().decode(
                [MeasurementMutation].self,
                from: Data(contentsOf: fileURL)
            )
        } catch {
            mutationLogger.error("read error: \(error.localizedDescription)")
            return []
        }
    }

    private func mutate(_ transform: (inout [MeasurementMutation]) -> Void) -> Bool {
        guard let fileURL else { return false }
        var mutations = loadAll()
        transform(&mutations)
        do {
            try JSONEncoder().encode(mutations).write(to: fileURL, options: .atomic)
            return true
        } catch {
            mutationLogger.error("write error: \(error.localizedDescription)")
            return false
        }
    }
}
