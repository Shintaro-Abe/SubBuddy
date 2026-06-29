import Foundation

/// App Group のデータを Mac の POST /api/usage/daily に送信する（段階6）。
/// 送信は本体アプリのフォアグラウンドで行う（拡張は通信しない）。
/// usageDailyBatchSchema に合わせた JSON を生成し、Bearer トークンで認証する。
final class UsageSyncService {

    private let store = SharedStore()
    private let mappingStore = MappingStore()

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

    /// 未送信の全レコードを送信する（MUST-7: 貯めて再送・冪等）
    func syncAll() async throws -> Int {
        let records = store.readAll()
        guard !records.isEmpty else { return 0 }

        var items: [UsageItem] = []
        for record in records {
            guard let subId = mappingStore.subscriptionId(for: record.activityId) else {
                continue
            }
            items.append(UsageItem(
                subscriptionId: subId,
                date: record.date,
                used: record.bucket != .none,
                usageBucket: record.bucket.wireValue,
                estimatedMinutesMin: record.bucket.lowerMinutes,
                estimatedMinutesMax: record.bucket.upperMinutes,
                source: SpikeConstants.source
            ))
        }

        guard !items.isEmpty else { return 0 }

        let payload = BatchPayload(items: items)
        try await send(payload)

        for record in records {
            store.remove(activityId: record.activityId, date: record.date)
        }

        print("[Sync] sent \(items.count) items")
        return items.count
    }

    private func send(_ payload: BatchPayload) async throws {
        let url = URL(string: SpikeConstants.apiBaseURL + SpikeConstants.usageEndpoint)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(SpikeConstants.syncToken)", forHTTPHeaderField: "Authorization")

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw SyncError.httpError(statusCode: code)
        }
    }

    enum SyncError: Error {
        case httpError(statusCode: Int)
    }
}
