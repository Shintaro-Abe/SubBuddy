import Combine
import Foundation

protocol UsageSyncing {
    func syncAll() async throws -> Int
}

enum UsageAutomaticSyncOutcome: Equatable {
    case skippedSignedOut
    case skippedInProgress
    case succeeded(Int)
    case failed
}

enum UsageSyncStatus {
    static let lastSuccessAtKey = "usage_sync_last_success_at"
    static let lastAttemptAtKey = "usage_sync_last_attempt_at"
    static let lastFailedKey = "usage_sync_last_failed"

    static func recordSuccess(at date: Date, defaults: UserDefaults = .standard) {
        defaults.set(date.timeIntervalSince1970, forKey: lastSuccessAtKey)
        defaults.set(date.timeIntervalSince1970, forKey: lastAttemptAtKey)
        defaults.set(false, forKey: lastFailedKey)
    }

    static func recordFailure(at date: Date, defaults: UserDefaults = .standard) {
        defaults.set(date.timeIntervalSince1970, forKey: lastAttemptAtKey)
        defaults.set(true, forKey: lastFailedKey)
    }
}

@MainActor
final class UsageAutoSyncCoordinator: ObservableObject {
    @Published private(set) var isSyncing = false

    private let syncService: any UsageSyncing
    private let defaults: UserDefaults
    private let now: () -> Date

    init(
        syncService: any UsageSyncing = UsageSyncService(),
        defaults: UserDefaults = .standard,
        now: @escaping () -> Date = Date.init
    ) {
        self.syncService = syncService
        self.defaults = defaults
        self.now = now
    }

    func syncIfEligible(isSignedIn: Bool) async -> UsageAutomaticSyncOutcome {
        guard isSignedIn else { return .skippedSignedOut }
        guard !isSyncing else { return .skippedInProgress }

        isSyncing = true
        defer { isSyncing = false }

        do {
            let count = try await syncService.syncAll()
            UsageSyncStatus.recordSuccess(at: now(), defaults: defaults)
            return .succeeded(count)
        } catch {
            UsageSyncStatus.recordFailure(at: now(), defaults: defaults)
            return .failed
        }
    }
}

final class UsageSyncService: UsageSyncing {
    private let store = SharedStore()
    private let mappingStore = MappingStore()
    private let mutationStore = MeasurementMutationStore()
    private let keychain = KeychainStore()

    struct UsageItem: Codable {
        let subscriptionId: String
        let date: String
        let used: Bool
        let usageBucket: String
        let estimatedMinutesMin: Int
        let estimatedMinutesMax: Int?
        let source: String
    }

    struct BatchPayload: Codable {
        let items: [UsageItem]
    }

    func syncAll() async throws -> Int {
        guard let apiBaseURL = AppConstants.apiBaseURL else {
            throw SyncError.apiBaseURLNotConfigured
        }
        guard let deviceSyncToken = try keychain.string(for: .deviceSyncToken) else {
            throw SyncError.deviceSyncTokenMissing
        }

        let today = AppConstants.localDateString()
        let records = store.readAll()
        guard !records.isEmpty else { return 0 }
        let pendingSubscriptionIDs = mutationStore.pendingSubscriptionIDs()

        let mappedRecords = Self.mappedRecords(
            records: records,
            mappingStore: mappingStore,
            pendingSubscriptionIDs: pendingSubscriptionIDs
        )
        let items = mappedRecords.map { $0.1 }

        guard !items.isEmpty else { return 0 }

        try await send(BatchPayload(items: items), apiBaseURL: apiBaseURL, deviceSyncToken: deviceSyncToken)

        let acknowledgedPastRecords = mappedRecords.map { $0.0 }.filter { $0.date < today }
        store.removeAcknowledged(acknowledgedPastRecords)

        return items.count
    }

    static func mappedRecords(
        records: [UsageRecord],
        mappingStore: any SubscriptionMappingStoring,
        pendingSubscriptionIDs: Set<String>
    ) -> [(UsageRecord, UsageItem)] {
        records.compactMap { record -> (UsageRecord, UsageItem)? in
            guard let subscriptionId = mappingStore.subscriptionId(for: record.activityId),
                  !pendingSubscriptionIDs.contains(subscriptionId) else {
                return nil
            }

            return (
                record,
                UsageItem(
                    subscriptionId: subscriptionId,
                    date: record.date,
                    used: record.bucket != .none,
                    usageBucket: record.bucket.wireValue,
                    estimatedMinutesMin: record.bucket.lowerMinutes,
                    estimatedMinutesMax: record.bucket.upperMinutes,
                    source: "ios_device_activity"
                )
            )
        }
    }

    private func send(_ payload: BatchPayload, apiBaseURL: URL, deviceSyncToken: String) async throws {
        guard let url = URL(string: "/api/usage/daily", relativeTo: apiBaseURL)?.absoluteURL else {
            throw SyncError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(deviceSyncToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw SyncError.httpStatus(httpResponse.statusCode)
        }
    }
}

enum SyncError: LocalizedError {
    case apiBaseURLNotConfigured
    case deviceSyncTokenMissing
    case invalidURL
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .apiBaseURLNotConfigured:
            return "API base URL is not configured."
        case .deviceSyncTokenMissing:
            return "Device sync token is missing."
        case .invalidURL:
            return "Invalid sync URL."
        case .invalidResponse:
            return "Invalid sync response."
        case .httpStatus(let statusCode):
            return "Sync failed with status \(statusCode)."
        }
    }
}
