import Foundation

final class UsageSyncService {
    private let store = SharedStore()
    private let mappingStore = MappingStore()
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

        let mappedRecords = records.compactMap { record -> (UsageRecord, UsageItem)? in
            guard let subscriptionId = mappingStore.subscriptionId(for: record.activityId) else {
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
        let items = mappedRecords.map { $0.1 }

        guard !items.isEmpty else { return 0 }

        try await send(BatchPayload(items: items), apiBaseURL: apiBaseURL, deviceSyncToken: deviceSyncToken)

        let acknowledgedPastRecords = mappedRecords.map { $0.0 }.filter { $0.date < today }
        store.removeAcknowledged(acknowledgedPastRecords)

        return items.count
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
