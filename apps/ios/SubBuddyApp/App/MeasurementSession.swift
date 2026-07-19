import Combine
import FamilyControls
import Foundation

enum MeasurementPolicy {
    static func shouldMonitor(
        isAuthorized: Bool,
        hasValidSubscription: Bool,
        hasSingleApplication: Bool,
        hasPendingMutation: Bool
    ) -> Bool {
        isAuthorized
            && hasValidSubscription
            && hasSingleApplication
            && !hasPendingMutation
    }
}

protocol MeasurementConfigurationCleaning {
    func removeConfiguration(subscriptionId: String)
    func removeOrphanedConfigurations(validSubscriptionIDs: Set<String>)
    func reconcileConfigurations(validSubscriptionIDs: Set<String>)
}

protocol MeasurementDataDeleting {
    func deleteMeasurementData(subscriptionId: String) async throws
}

final class MeasurementDataService: MeasurementDataDeleting {
    private let client: APIClient?

    init() {
        client = AppConstants.apiBaseURL.map { APIClient(baseURL: $0) }
    }

    init(client: APIClient) {
        self.client = client
    }

    func deleteMeasurementData(subscriptionId: String) async throws {
        guard let client else {
            throw APIError.invalidURL
        }
        let _: DeleteResponse = try await client.sendAuthenticated(
            path: "/api/subscriptions/\(subscriptionId)/usage",
            method: "DELETE",
            body: EmptyRequest()
        )
    }
}

final class MeasurementConfigurationCleaner: MeasurementConfigurationCleaning {
    private let scheduler: any MonitoringScheduling
    private let mappingStore: any SubscriptionMappingStoring
    private let usageStore: any UsageRecordStoring
    private let mutationStore: any MeasurementMutationStoring
    private let isAuthorized: () -> Bool

    init(
        scheduler: any MonitoringScheduling = MonitorScheduler(),
        mappingStore: any SubscriptionMappingStoring = MappingStore(),
        usageStore: any UsageRecordStoring = SharedStore(),
        mutationStore: any MeasurementMutationStoring = MeasurementMutationStore(),
        isAuthorized: @escaping () -> Bool = {
            AuthorizationCenter.shared.authorizationStatus == .approved
        }
    ) {
        self.scheduler = scheduler
        self.mappingStore = mappingStore
        self.usageStore = usageStore
        self.mutationStore = mutationStore
        self.isAuthorized = isAuthorized
    }

    func removeConfiguration(subscriptionId: String) {
        let activityName = mappingStore.mapping(for: subscriptionId)?.activityName
            ?? mappingStore.activityName(for: subscriptionId)
        scheduler.stopMonitoring(activityName: activityName)
        _ = usageStore.remove(activityId: activityName)
        _ = mappingStore.remove(subscriptionId: subscriptionId)
        _ = mutationStore.remove(subscriptionId: subscriptionId)
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

    func reconcileConfigurations(validSubscriptionIDs: Set<String>) {
        removeOrphanedConfigurations(validSubscriptionIDs: validSubscriptionIDs)
        let pending = mutationStore.pendingSubscriptionIDs()

        for subscriptionId in validSubscriptionIDs {
            guard let mapping = mappingStore.mapping(for: subscriptionId),
                  let selection = try? JSONDecoder().decode(
                    FamilyActivitySelection.self,
                    from: mapping.selection
                  ), MeasurementSession.isSingleApplication(
                    applicationCount: selection.applicationTokens.count,
                    categoryCount: selection.categoryTokens.count,
                    webDomainCount: selection.webDomainTokens.count
                  ) else {
                continue
            }

            let shouldMonitor = MeasurementPolicy.shouldMonitor(
                isAuthorized: isAuthorized(),
                hasValidSubscription: true,
                hasSingleApplication: true,
                hasPendingMutation: pending.contains(subscriptionId)
            )
            if !shouldMonitor {
                if scheduler.activeActivities.contains(mapping.activityName) {
                    scheduler.stopMonitoring(activityName: mapping.activityName)
                }
            } else if !scheduler.activeActivities.contains(mapping.activityName) {
                try? scheduler.startMonitoring(
                    activityName: mapping.activityName,
                    selection: selection
                )
            }
        }
    }
}

@MainActor
final class MeasurementSession: ObservableObject {
    @Published var subscriptionId = ""
    @Published var selection = FamilyActivitySelection()
    @Published private(set) var statusMessage = "計測対象は未設定です"
    @Published private(set) var recordCount = 0
    @Published private(set) var isMonitoring = false
    @Published private(set) var isSyncing = false
    @Published private(set) var isChangingConfiguration = false
    @Published private(set) var hasConfiguration = false
    @Published private(set) var hasPendingMutation = false

    private let scheduler: any MonitoringScheduling
    private let mappingStore: any SubscriptionMappingStoring
    private let usageStore: any UsageRecordStoring
    private let mutationStore: any MeasurementMutationStoring
    private let measurementDataService: any MeasurementDataDeleting
    private let isAuthorized: () -> Bool
    private let syncService = UsageSyncService()

    init(
        scheduler: any MonitoringScheduling = MonitorScheduler(),
        mappingStore: any SubscriptionMappingStoring = MappingStore(),
        usageStore: any UsageRecordStoring = SharedStore(),
        mutationStore: any MeasurementMutationStoring = MeasurementMutationStore(),
        measurementDataService: any MeasurementDataDeleting = MeasurementDataService(),
        isAuthorized: @escaping () -> Bool = {
            AuthorizationCenter.shared.authorizationStatus == .approved
        }
    ) {
        self.scheduler = scheduler
        self.mappingStore = mappingStore
        self.usageStore = usageStore
        self.mutationStore = mutationStore
        self.measurementDataService = measurementDataService
        self.isAuthorized = isAuthorized
    }

    func load(subscriptionId: String) {
        self.subscriptionId = subscriptionId
        hasPendingMutation = mutationStore.mutation(for: subscriptionId) != nil
        if hasPendingMutation {
            let activityName = mappingStore.activityName(for: subscriptionId)
            scheduler.stopMonitoring(activityName: activityName)
            isMonitoring = false
            hasConfiguration = mappingStore.mapping(for: subscriptionId) != nil
            statusMessage = "計測対象の変更が完了していません。再試行してください"
            return
        }

        let activityName = mappingStore.activityName(for: subscriptionId)
        let isActive = scheduler.activeActivities.contains(activityName)

        guard let mapping = mappingStore.mapping(for: subscriptionId) else {
            if isActive {
                scheduler.stopMonitoring(activityName: activityName)
            }
            _ = usageStore.remove(activityId: activityName)
            selection = FamilyActivitySelection()
            isMonitoring = false
            hasConfiguration = false
            statusMessage = isActive
                ? "保存済み設定がないため計測を停止しました。アプリを選び直してください"
                : "計測対象は未設定です"
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
            hasConfiguration = false
            statusMessage = "以前の計測設定を使えません。アプリを1つ選び直してください"
            return
        }

        selection = savedSelection
        hasConfiguration = true
        reconcileCurrentConfiguration()
    }

    func select(_ candidate: FamilyActivitySelection) {
        guard !hasConfiguration else {
            statusMessage = "計測対象を変更するには、変更内容を確認してください"
            return
        }
        guard validate(candidate) else { return }
        guard saveMapping(candidate) else { return }
        selection = candidate
        hasConfiguration = true
        reconcileCurrentConfiguration()
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

    func isCurrentSelection(_ candidate: FamilyActivitySelection) -> Bool {
        selection.applicationTokens == candidate.applicationTokens
            && selection.categoryTokens == candidate.categoryTokens
            && selection.webDomainTokens == candidate.webDomainTokens
    }

    func replaceSelection(with candidate: FamilyActivitySelection) async {
        guard validate(candidate) else { return }
        await beginMutation(operation: .replace, replacement: candidate)
    }

    func removeConfiguration() async {
        await beginMutation(operation: .unlink, replacement: nil)
    }

    func retryPendingMutation() async {
        guard let mutation = mutationStore.mutation(for: subscriptionId) else {
            hasPendingMutation = false
            reconcileCurrentConfiguration()
            return
        }
        await execute(mutation)
    }

    func authorizationDidChange(validSubscriptionIDs: Set<String>? = nil) {
        if let validSubscriptionIDs {
            MeasurementConfigurationCleaner(
                scheduler: scheduler,
                mappingStore: mappingStore,
                usageStore: usageStore,
                mutationStore: mutationStore,
                isAuthorized: isAuthorized
            ).reconcileConfigurations(validSubscriptionIDs: validSubscriptionIDs)
        }
        reconcileCurrentConfiguration()
    }

    private func validate(_ candidate: FamilyActivitySelection) -> Bool {
        let trimmedSubscriptionId = subscriptionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedSubscriptionId.isEmpty else {
            statusMessage = "対象の契約を確認できませんでした"
            return false
        }
        guard Self.isSingleApplication(candidate) else {
            statusMessage = "計測するアプリを1つだけ選んでください"
            return false
        }
        return validateConflict(candidate, subscriptionId: trimmedSubscriptionId)
    }

    private func validateConflict(
        _ candidate: FamilyActivitySelection,
        subscriptionId: String
    ) -> Bool {
        guard mappingStore.conflictingSubscriptionId(
            for: candidate,
            excluding: subscriptionId
        ) == nil else {
            statusMessage = "このアプリは別の契約で計測しています"
            return false
        }
        return true
    }

    private func saveMapping(_ candidate: FamilyActivitySelection) -> Bool {
        let trimmedSubscriptionId = subscriptionId.trimmingCharacters(in: .whitespacesAndNewlines)
        let activityName = mappingStore.activityName(for: trimmedSubscriptionId)
        guard let selectionData = try? JSONEncoder().encode(candidate) else {
            statusMessage = "選択したアプリを保存できませんでした"
            return false
        }
        guard mappingStore.save(SubscriptionMapping(
            subscriptionId: trimmedSubscriptionId,
            activityName: activityName,
            selection: selectionData
        )) else {
            statusMessage = "計測設定を保存できませんでした"
            return false
        }
        return true
    }

    private func reconcileCurrentConfiguration() {
        let trimmedSubscriptionId = subscriptionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedSubscriptionId.isEmpty,
              let mapping = mappingStore.mapping(for: trimmedSubscriptionId),
              let savedSelection = try? JSONDecoder().decode(
                FamilyActivitySelection.self,
                from: mapping.selection
              ), Self.isSingleApplication(savedSelection) else {
            isMonitoring = false
            hasConfiguration = false
            statusMessage = "計測対象は未設定です"
            return
        }

        selection = savedSelection
        hasConfiguration = true
        let activityName = mapping.activityName
        guard MeasurementPolicy.shouldMonitor(
            isAuthorized: isAuthorized(),
            hasValidSubscription: true,
            hasSingleApplication: true,
            hasPendingMutation: hasPendingMutation
        ) else {
            if scheduler.activeActivities.contains(activityName) {
                scheduler.stopMonitoring(activityName: activityName)
            }
            isMonitoring = false
            statusMessage = "Screen Timeを許可すると自動的に計測を始めます"
            return
        }

        if scheduler.activeActivities.contains(activityName) {
            isMonitoring = true
            statusMessage = "計測中です"
            return
        }
        do {
            try scheduler.startMonitoring(activityName: activityName, selection: savedSelection)
            isMonitoring = true
            statusMessage = "計測を自動的に開始しました"
        } catch {
            isMonitoring = false
            statusMessage = "計測を開始できませんでした"
        }
    }

    private func beginMutation(
        operation: MeasurementMutation.Operation,
        replacement: FamilyActivitySelection?
    ) async {
        let activityName = mappingStore.mapping(for: subscriptionId)?.activityName
            ?? mappingStore.activityName(for: subscriptionId)
        let replacementData = replacement.flatMap { try? JSONEncoder().encode($0) }
        if operation == .replace, replacementData == nil {
            statusMessage = "選択したアプリを保存できませんでした"
            return
        }
        let mutation = MeasurementMutation(
            subscriptionId: subscriptionId,
            oldActivityName: activityName,
            replacementSelection: replacementData,
            operation: operation
        )
        guard mutationStore.save(mutation) else {
            statusMessage = "変更内容を端末に保存できませんでした"
            return
        }
        hasPendingMutation = true
        await execute(mutation)
    }

    private func execute(_ mutation: MeasurementMutation) async {
        guard !isChangingConfiguration else { return }
        isChangingConfiguration = true
        defer { isChangingConfiguration = false }

        scheduler.stopMonitoring(activityName: mutation.oldActivityName)
        isMonitoring = false

        do {
            try await measurementDataService.deleteMeasurementData(
                subscriptionId: mutation.subscriptionId
            )
            guard usageStore.remove(activityId: mutation.oldActivityName),
                  mappingStore.remove(subscriptionId: mutation.subscriptionId) else {
                statusMessage = "端末内の計測データを削除できませんでした。再試行してください"
                return
            }

            if mutation.operation == .replace {
                guard let replacementData = mutation.replacementSelection,
                      let replacement = try? JSONDecoder().decode(
                        FamilyActivitySelection.self,
                        from: replacementData
                      ), validate(replacement), saveMapping(replacement) else {
                    statusMessage = "新しい計測対象を設定できませんでした。再試行してください"
                    return
                }
                selection = replacement
                hasConfiguration = true
            } else {
                selection = FamilyActivitySelection()
                hasConfiguration = false
            }

            guard mutationStore.remove(subscriptionId: mutation.subscriptionId) else {
                statusMessage = "変更の完了状態を保存できませんでした。再試行してください"
                return
            }
            hasPendingMutation = false

            if mutation.operation == .replace {
                reconcileCurrentConfiguration()
            } else {
                isMonitoring = false
                statusMessage = "計測対象との対応付けと過去の利用量を削除しました"
            }
        } catch {
            hasPendingMutation = true
            statusMessage = "計測対象の変更を完了できませんでした。通信を確認して再試行してください"
        }
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
