import Combine
import FamilyControls
import Foundation

protocol MeasurementConfigurationCleaning {
    func removeConfiguration(subscriptionId: String)
    func removeOrphanedConfigurations(validSubscriptionIDs: Set<String>)
}

final class MeasurementConfigurationCleaner: MeasurementConfigurationCleaning {
    private let scheduler: any MonitoringScheduling
    private let mappingStore: any SubscriptionMappingStoring
    private let usageStore: any UsageRecordStoring

    init(
        scheduler: any MonitoringScheduling = MonitorScheduler(),
        mappingStore: any SubscriptionMappingStoring = MappingStore(),
        usageStore: any UsageRecordStoring = SharedStore()
    ) {
        self.scheduler = scheduler
        self.mappingStore = mappingStore
        self.usageStore = usageStore
    }

    func removeConfiguration(subscriptionId: String) {
        let activityName = mappingStore.mapping(for: subscriptionId)?.activityName
            ?? mappingStore.activityName(for: subscriptionId)
        scheduler.stopMonitoring(activityName: activityName)
        _ = usageStore.remove(activityId: activityName)
        _ = mappingStore.remove(subscriptionId: subscriptionId)
    }

    func removeOrphanedConfigurations(validSubscriptionIDs: Set<String>) {
        for activityName in scheduler.activeActivities
            where mappingStore.subscriptionId(for: activityName) == nil {
            scheduler.stopMonitoring(activityName: activityName)
        }

        let orphaned = mappingStore.subscriptionIDs().filter {
            !validSubscriptionIDs.contains($0)
        }
        let idsToRemove = Set(orphaned + mappingStore.invalidOrDuplicateSubscriptionIDs())
        for subscriptionId in idsToRemove {
            removeConfiguration(subscriptionId: subscriptionId)
        }

        let orphanedActivityIDs = Set(usageStore.readAll().map(\.activityId)).filter {
            mappingStore.subscriptionId(for: $0) == nil
        }
        for activityId in orphanedActivityIDs {
            _ = usageStore.remove(activityId: activityId)
        }
    }
}

@MainActor
final class MeasurementSession: ObservableObject {
    @Published var subscriptionId = ""
    @Published var selection = FamilyActivitySelection()
    @Published private(set) var statusMessage = "計測は停止しています"
    @Published private(set) var recordCount = 0
    @Published private(set) var isMonitoring = false
    @Published private(set) var isSyncing = false

    private let scheduler: any MonitoringScheduling
    private let mappingStore: any SubscriptionMappingStoring
    private let usageStore: any UsageRecordStoring
    private let syncService = UsageSyncService()

    init(
        scheduler: any MonitoringScheduling = MonitorScheduler(),
        mappingStore: any SubscriptionMappingStoring = MappingStore(),
        usageStore: any UsageRecordStoring = SharedStore()
    ) {
        self.scheduler = scheduler
        self.mappingStore = mappingStore
        self.usageStore = usageStore
    }

    func load(subscriptionId: String) {
        self.subscriptionId = subscriptionId
        let activityName = mappingStore.activityName(for: subscriptionId)
        let isActive = scheduler.activeActivities.contains(activityName)

        guard let mapping = mappingStore.mapping(for: subscriptionId) else {
            if isActive {
                scheduler.stopMonitoring(activityName: activityName)
            }
            _ = usageStore.remove(activityId: activityName)
            selection = FamilyActivitySelection()
            isMonitoring = false
            statusMessage = isActive
                ? "保存済み設定がないため計測を停止しました。アプリを選び直してください"
                : "計測は停止しています"
            return
        }

        guard let savedSelection = try? JSONDecoder().decode(
            FamilyActivitySelection.self,
            from: mapping.selection
        ), Self.isSingleApplication(savedSelection) else {
            if isActive {
                scheduler.stopMonitoring(activityName: activityName)
            }
            _ = usageStore.remove(activityId: mapping.activityName)
            _ = mappingStore.remove(subscriptionId: subscriptionId)
            selection = FamilyActivitySelection()
            isMonitoring = false
            statusMessage = "以前の計測設定を使えません。アプリを1つ選び直してください"
            return
        }

        selection = savedSelection
        isMonitoring = isActive
        statusMessage = isActive ? "計測を開始しました" : "計測は停止しています"
    }

    func select(_ candidate: FamilyActivitySelection) {
        guard !isMonitoring else {
            statusMessage = "計測対象を変更するには、現在の計測を停止してください"
            return
        }
        guard Self.isSingleApplication(candidate) else {
            statusMessage = "計測するアプリを1つだけ選んでください"
            return
        }
        if mappingStore.conflictingSubscriptionId(
            for: candidate,
            excluding: subscriptionId
        ) != nil {
            statusMessage = "このアプリは別の契約で計測しています"
            return
        }

        selection = candidate
        statusMessage = "アプリを1つ選択しました"
    }

    static func isSingleApplication(_ selection: FamilyActivitySelection) -> Bool {
        isSingleApplication(
            applicationCount: selection.applicationTokens.count,
            categoryCount: selection.categoryTokens.count,
            webDomainCount: selection.webDomainTokens.count
        )
    }

    nonisolated static func isSingleApplication(
        applicationCount: Int,
        categoryCount: Int,
        webDomainCount: Int
    ) -> Bool {
        applicationCount == 1 && categoryCount == 0 && webDomainCount == 0
    }

    func startMonitoring() {
        let trimmedSubscriptionId = subscriptionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedSubscriptionId.isEmpty else {
            statusMessage = "対象の契約を確認できませんでした"
            return
        }
        guard Self.isSingleApplication(selection) else {
            statusMessage = "計測するアプリを1つだけ選んでください"
            return
        }
        guard mappingStore.conflictingSubscriptionId(
            for: selection,
            excluding: trimmedSubscriptionId
        ) == nil else {
            statusMessage = "このアプリは別の契約で計測しています"
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
        let activityName = mappingStore.activityName(for: subscriptionId)
        scheduler.stopMonitoring(activityName: activityName)
        isMonitoring = false
        statusMessage = "計測を停止しました"
    }

    func removeConfiguration() {
        let activityName = mappingStore.mapping(for: subscriptionId)?.activityName
            ?? mappingStore.activityName(for: subscriptionId)
        scheduler.stopMonitoring(activityName: activityName)
        guard usageStore.remove(activityId: activityName) else {
            statusMessage = "端末内の利用記録を削除できませんでした"
            return
        }
        guard mappingStore.remove(subscriptionId: subscriptionId) else {
            statusMessage = "計測設定を解除できませんでした"
            return
        }
        selection = FamilyActivitySelection()
        isMonitoring = false
        statusMessage = "アプリとの紐付けを解除しました"
    }

    func refreshRecords() {
        recordCount = usageStore.readAll().count
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
