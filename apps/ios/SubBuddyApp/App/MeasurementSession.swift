import Combine
import FamilyControls
import Foundation

@MainActor
final class MeasurementSession: ObservableObject {
    @Published var subscriptionId = ""
    @Published var selection = FamilyActivitySelection()
    @Published private(set) var statusMessage = "計測は停止しています"
    @Published private(set) var recordCount = 0
    @Published private(set) var isMonitoring = false
    @Published private(set) var isSyncing = false

    private let scheduler = MonitorScheduler()
    private let mappingStore = MappingStore()
    private let store = SharedStore()
    private let syncService = UsageSyncService()

    func startMonitoring() {
        let trimmedSubscriptionId = subscriptionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedSubscriptionId.isEmpty else {
            statusMessage = "対象の契約を確認できませんでした"
            return
        }
        guard !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty else {
            statusMessage = "計測するアプリを1つ以上選んでください"
            return
        }

        let activityName = mappingStore.activityName(for: trimmedSubscriptionId)
        guard let selectionData = try? JSONEncoder().encode(selection) else {
            statusMessage = "選択したアプリを保存できませんでした"
            return
        }
        guard mappingStore.save(SubscriptionMapping(
            subscriptionId: trimmedSubscriptionId,
            activityName: activityName,
            selection: selectionData
        )) else {
            statusMessage = "計測設定を保存できませんでした"
            return
        }

        do {
            try scheduler.startMonitoring(activityName: activityName, selection: selection)
            isMonitoring = true
            statusMessage = "計測を開始しました"
        } catch {
            statusMessage = "計測を開始できませんでした"
        }
    }

    func stopMonitoring() {
        scheduler.stopAll()
        isMonitoring = false
        statusMessage = "計測を停止しました"
    }

    func refreshRecords() {
        recordCount = store.readAll().count
        statusMessage = "端末内の未送信記録は\(recordCount)件です"
    }

    func syncRecords() async {
        isSyncing = true
        defer { isSyncing = false }

        do {
            let count = try await syncService.syncAll()
            refreshRecords()
            statusMessage = "\(count)件を同期しました"
        } catch {
            statusMessage = "同期できませんでした。通信を確認して、もう一度お試しください"
        }
    }
}
