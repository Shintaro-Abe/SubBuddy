import FamilyControls
import Foundation

@MainActor
final class MeasurementSession: ObservableObject {
    @Published var subscriptionId = ""
    @Published var selection = FamilyActivitySelection()
    @Published private(set) var statusMessage = "Not monitoring"
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
            statusMessage = "Subscription ID is required"
            return
        }
        guard !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty else {
            statusMessage = "Select at least one measured app"
            return
        }

        let activityName = mappingStore.activityName(for: trimmedSubscriptionId)
        guard let selectionData = try? JSONEncoder().encode(selection) else {
            statusMessage = "Monitoring failed: selection encoding failed"
            return
        }
        guard mappingStore.save(SubscriptionMapping(
            subscriptionId: trimmedSubscriptionId,
            activityName: activityName,
            selection: selectionData
        )) else {
            statusMessage = "Monitoring failed: shared mapping store unavailable"
            return
        }

        do {
            try scheduler.startMonitoring(activityName: activityName, selection: selection)
            isMonitoring = true
            statusMessage = "Monitoring started"
        } catch {
            statusMessage = "Monitoring failed: \(error.localizedDescription)"
        }
    }

    func stopMonitoring() {
        scheduler.stopAll()
        isMonitoring = false
        statusMessage = "Monitoring stopped"
    }

    func refreshRecords() {
        recordCount = store.readAll().count
        statusMessage = "Records: \(recordCount)"
    }

    func syncRecords() async {
        isSyncing = true
        defer { isSyncing = false }

        do {
            let count = try await syncService.syncAll()
            refreshRecords()
            statusMessage = "Synced records: \(count)"
        } catch {
            statusMessage = "Sync failed: \(error.localizedDescription)"
        }
    }
}
