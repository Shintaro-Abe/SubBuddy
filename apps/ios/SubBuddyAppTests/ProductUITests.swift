import FamilyControls
import XCTest
import UIKit
@testable import SubBuddyApp

final class ProductUITests: XCTestCase {
    func testGuidanceProgressAdvancesWithoutRequiringMeasurement() {
        let progressed = GuidanceProgress.empty
            .applying(.inventoryCompleted)
            .applying(.spendingViewed)
            .applying(.reviewViewed)
            .applying(.measurementSkipped)

        XCTAssertTrue(progressed.isComplete)
        XCTAssertEqual(progressed.completedCount, 4)
        XCTAssertNil(progressed.nextStep)
        XCTAssertEqual(progressed.measurementChoice, "skipped")
    }

    func testGuidanceProgressShowsOnlyFirstIncompleteStep() {
        let progressed = GuidanceProgress.empty
            .applying(.inventoryCompleted)
            .applying(.spendingViewed)

        XCTAssertEqual(progressed.completedCount, 2)
        XCTAssertEqual(progressed.nextStep, .review)
        XCTAssertFalse(progressed.isComplete)
    }

    func testFirstReviewDetailCompletesReviewGuidanceStep() {
        let beforeReview = GuidanceProgress.empty
            .applying(.inventoryCompleted)
            .applying(.spendingViewed)

        let afterReview = beforeReview.applying(.reviewViewed)

        XCTAssertTrue(afterReview.steps.review)
        XCTAssertEqual(afterReview.completedCount, 3)
        XCTAssertEqual(afterReview.nextStep, .measurement)
    }

    @MainActor
    func testPendingGuidanceDoesNotRollBackWhenRetryFails() async {
        let suiteName = "guidance-progress-synthetic-test"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = ProductStore(
            client: SyntheticProductAPI(guidanceShouldFail: true),
            measurementCleaner: NoopMeasurementCleaner(),
            guidanceDefaults: defaults
        )

        await store.recordGuidanceEvent(.inventoryCompleted)
        await store.refreshGuidanceProgress()

        XCTAssertTrue(store.guidanceProgress.steps.inventory)
        XCTAssertEqual(store.guidanceProgress.nextStep, .spending)
    }

    func testSubscriptionDeletionExplainsMeasurementCleanupAndScope() {
        let message = SubscriptionDeletionCopy.confirmationMessage

        XCTAssertTrue(message.contains("計測対象アプリとの紐付け"))
        XCTAssertTrue(message.contains("端末内の未送信利用記録"))
        XCTAssertTrue(message.contains("クラウドへ同期済みの利用集計"))
        XCTAssertTrue(message.contains("他の契約には影響しません"))
        XCTAssertTrue(message.contains("元に戻せません"))
    }

    func testWebBrandFontsAreRegisteredInAppBundle() {
        let fonts = [
            (file: "ZenKakuGothicNew-Regular", postScriptName: "ZenKakuGothicNew-Regular"),
            (file: "ZenKakuGothicNew-Bold", postScriptName: "ZenKakuGothicNew-Bold"),
            (file: "ShipporiMincho-SemiBold", postScriptName: "ShipporiMincho-SemiBold"),
            (file: "BIZUDPGothic-Regular", postScriptName: "BIZUDPGothic-Regular"),
            (file: "BIZUDPGothic-Bold", postScriptName: "BIZUDPGothic-Bold"),
            (file: "EBGaramond[wght]", postScriptName: "EBGaramond-Regular"),
        ]
        let appBundle = Bundle(for: ProductStore.self)

        for font in fonts {
            XCTAssertNotNil(
                appBundle.url(forResource: font.file, withExtension: "ttf"),
                "\(font.file).ttf is not copied into the app bundle"
            )
            XCTAssertNotNil(
                UIFont(name: font.postScriptName, size: 17),
                "\(font.postScriptName) is copied but not registered by UIAppFonts"
            )
        }
    }

    func testMonthlySubscriptionCalculatesYearlyAmount() {
        XCTAssertEqual(PreviewFixtures.video.monthlyAmount, 1_000)
        XCTAssertEqual(PreviewFixtures.video.yearlyAmount, 12_000)
    }

    func testYearlySubscriptionCalculatesRoundedMonthlyAmount() {
        let yearly = Subscription(
            id: "synthetic-yearly",
            name: "合成年払いサービス",
            normalizedName: nil,
            category: "other",
            amount: 10_000,
            currency: "JPY",
            billingCycle: .yearly,
            nextRenewalDate: nil,
            signupChannel: nil,
            status: .active,
            importance: 3,
            cancellationUrl: nil,
            notes: nil,
            matchedServiceId: nil,
            usageType: "active_foreground",
            initialValueAnswer: nil,
            planCapacityGb: nil,
            usedCapacityGb: nil,
            capacityCheckedAt: nil,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
        )

        XCTAssertEqual(yearly.monthlyAmount, 833)
        XCTAssertEqual(yearly.yearlyAmount, 10_000)
    }

    func testMatchedPatternDecodesUserFacingEvidenceWithoutRequiringInternalCode() throws {
        let data = Data(#"{"pattern":"P5","label":"更新が近い","evidence":"5日後に更新予定です","caveat":"日付を確認してください"}"#.utf8)
        let pattern = try JSONDecoder().decode(MatchedPattern.self, from: data)

        XCTAssertEqual(pattern.label, "更新が近い")
        XCTAssertEqual(pattern.detail, "5日後に更新予定です")
        XCTAssertEqual(pattern.caveat, "日付を確認してください")
        XCTAssertEqual(pattern.code, "P5")
    }

    func testReviewPriorityLabelsDoNotExposeInternalCodes() {
        for priority in ReviewPriority.allCases {
            XCTAssertFalse(priority.label.contains(priority.rawValue))
            XCTAssertFalse(priority.label.isEmpty)
        }
    }

    func testSubscriptionInputEncodesJPYAndOmitsAbsentOptionalValues() throws {
        let input = SubscriptionInput(
            name: "合成サービス",
            category: "other",
            amount: 500,
            currency: "JPY",
            billingCycle: .monthly,
            nextRenewalDate: nil,
            importance: 3,
            cancellationUrl: nil,
            notes: nil,
            signupChannel: nil,
            status: .active,
            matchedServiceId: nil,
            usageType: "active_foreground",
            initialValueAnswer: nil,
            planCapacityGb: nil,
            usedCapacityGb: nil,
            capacityCheckedAt: nil
        )
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as? [String: Any]
        )

        XCTAssertEqual(object["currency"] as? String, "JPY")
        XCTAssertEqual(object["amount"] as? Int, 500)
        XCTAssertNil(object["notes"])
        XCTAssertNil(object["nextRenewalDate"])
    }

    func testPreviewFixturesUseSyntheticIdentifiersOnly() {
        XCTAssertTrue(PreviewFixtures.populated.subscriptions.allSatisfy { $0.id.hasPrefix("synthetic-") })
        XCTAssertTrue(PreviewFixtures.video.cancellationUrl?.contains("example.invalid") == true)
    }

    func testTwoHundredSubscriptionFixtureIsSyntheticAndUnique() {
        let subscriptions = PreviewFixtures.twoHundredSubscriptions

        XCTAssertEqual(subscriptions.count, 200)
        XCTAssertEqual(Set(subscriptions.map(\.id)).count, 200)
        XCTAssertTrue(subscriptions.allSatisfy { $0.id.hasPrefix("synthetic-load-") })
        XCTAssertTrue(subscriptions.allSatisfy { $0.cancellationUrl?.contains("example.invalid") == true })
    }

    func testSubscriptionResponseDecodesServerDateStrings() throws {
        let data = Data(#"""
        {
          "id":"synthetic-sub","name":"合成サービス","normalizedName":null,"category":"other",
          "amount":500,"currency":"JPY","billingCycle":"monthly",
          "nextRenewalDate":"2026-08-01T00:00:00.000Z","signupChannel":null,"status":"active",
          "importance":3,"cancellationUrl":null,"notes":null,"matchedServiceId":null,
          "usageType":"active_foreground","initialValueAnswer":null,"planCapacityGb":null,
          "usedCapacityGb":null,"capacityCheckedAt":null,"createdAt":"2026-07-01T00:00:00.000Z",
          "updatedAt":"2026-07-16T00:00:00.000Z"
        }
        """#.utf8)

        let subscription = try JSONDecoder().decode(Subscription.self, from: data)

        XCTAssertEqual(subscription.id, "synthetic-sub")
        XCTAssertEqual(subscription.nextRenewalDate, "2026-08-01T00:00:00.000Z")
    }

    func testSessionResponseDecodesPrivacyMinimizedFields() throws {
        let data = Data(#"""
        {
          "id":"synthetic-session","clientType":"ios","deviceName":"iPhone",
          "createdAt":"2026-07-01T00:00:00.000Z","lastUsedAt":"2026-07-16T00:00:00.000Z",
          "current":true
        }
        """#.utf8)

        let session = try JSONDecoder().decode(UserSession.self, from: data)

        XCTAssertEqual(session.clientType, "ios")
        XCTAssertEqual(session.deviceName, "iPhone")
        XCTAssertTrue(session.current == true)
    }

    @MainActor
    func testProductStoreLoadsDashboardCollectionsFromInjectedBoundary() async {
        let store = ProductStore(
            client: SyntheticProductAPI(),
            measurementCleaner: NoopMeasurementCleaner()
        )

        await store.loadAll()

        XCTAssertEqual(store.subscriptions.map(\.id), [PreviewFixtures.video.id])
        XCTAssertEqual(store.dashboard?.yearlyTotal, 12_000)
        XCTAssertEqual(store.recommendations.map(\.id), [PreviewFixtures.videoReview.id])
        XCTAssertNil(store.errorMessage)
    }

    @MainActor
    func testProductStoreKeepsOnlySafeMessageForBlockedReview() async {
        let blocked = BlockedRecommendation(
            subscriptionId: PreviewFixtures.video.id,
            message: "見直し材料を再計算してください。"
        )
        let store = ProductStore(
            client: SyntheticProductAPI(blockedItems: [blocked]),
            measurementCleaner: NoopMeasurementCleaner()
        )

        await store.loadAll()

        XCTAssertTrue(store.recommendations.isEmpty)
        XCTAssertEqual(store.blockedRecommendations, [blocked])
    }

    @MainActor
    func testExistingSubscriptionLoadUsesOnlySubscriptionEndpoint() async {
        let store = ProductStore(
            client: ExistingSubscriptionProductAPI(result: .populated),
            measurementCleaner: NoopMeasurementCleaner()
        )

        let outcome = await store.loadExistingSubscriptions()

        XCTAssertEqual(outcome, .populated)
        XCTAssertEqual(store.subscriptions.map(\.id), [PreviewFixtures.video.id])
        XCTAssertNil(store.errorMessage)
    }

    @MainActor
    func testExistingSubscriptionLoadKeepsEmptyResultOnOnboarding() async {
        let store = ProductStore(
            client: ExistingSubscriptionProductAPI(result: .empty),
            measurementCleaner: NoopMeasurementCleaner()
        )

        let outcome = await store.loadExistingSubscriptions()

        XCTAssertEqual(outcome, .empty)
        XCTAssertTrue(store.subscriptions.isEmpty)
        XCTAssertNil(store.errorMessage)
    }

    @MainActor
    func testExistingSubscriptionLoadSeparatesFailureFromEmptyResult() async {
        let store = ProductStore(
            client: ExistingSubscriptionProductAPI(result: .failure),
            measurementCleaner: NoopMeasurementCleaner()
        )

        let outcome = await store.loadExistingSubscriptions()

        XCTAssertEqual(outcome, .failed)
        XCTAssertTrue(store.subscriptions.isEmpty)
        XCTAssertNotNil(store.errorMessage)
    }

    @MainActor
    func testExistingSubscriptionLoadRequestsReauthenticationForExpiredSession() async {
        let store = ProductStore(
            client: ExistingSubscriptionProductAPI(result: .reauthenticationRequired),
            measurementCleaner: NoopMeasurementCleaner()
        )

        let outcome = await store.loadExistingSubscriptions()

        XCTAssertEqual(outcome, .failed)
        XCTAssertTrue(store.requiresReauthentication)
        XCTAssertTrue(store.errorMessage?.contains("Appleで再認証") == true)
    }

    @MainActor
    func testProductStoreClearsSensitiveDataAtAuthenticationBoundary() async {
        let store = ProductStore(
            client: SyntheticProductAPI(),
            measurementCleaner: NoopMeasurementCleaner()
        )
        await store.loadAll()

        store.clearSensitiveData()

        XCTAssertTrue(store.subscriptions.isEmpty)
        XCTAssertTrue(store.recommendations.isEmpty)
        XCTAssertTrue(store.blockedRecommendations.isEmpty)
        XCTAssertNil(store.dashboard)
        XCTAssertNil(store.spending)
        XCTAssertNil(store.lastUpdatedAt)
    }

    func testMeasurementSelectionRequiresExactlyOneApplication() {
        XCTAssertTrue(MeasurementSession.isSingleApplication(
            applicationCount: 1,
            categoryCount: 0,
            webDomainCount: 0
        ))
        XCTAssertFalse(MeasurementSession.isSingleApplication(
            applicationCount: 0,
            categoryCount: 0,
            webDomainCount: 0
        ))
        XCTAssertFalse(MeasurementSession.isSingleApplication(
            applicationCount: 2,
            categoryCount: 0,
            webDomainCount: 0
        ))
        XCTAssertFalse(MeasurementSession.isSingleApplication(
            applicationCount: 1,
            categoryCount: 1,
            webDomainCount: 0
        ))
        XCTAssertFalse(MeasurementSession.isSingleApplication(
            applicationCount: 1,
            categoryCount: 0,
            webDomainCount: 1
        ))
    }

    func testMeasurementPolicyRequiresAuthorizationContractMappingAndNoMutation() {
        XCTAssertTrue(MeasurementPolicy.shouldMonitor(
            isAuthorized: true,
            hasValidSubscription: true,
            hasSingleApplication: true,
            hasPendingMutation: false
        ))
        XCTAssertFalse(MeasurementPolicy.shouldMonitor(
            isAuthorized: false,
            hasValidSubscription: true,
            hasSingleApplication: true,
            hasPendingMutation: false
        ))
        XCTAssertFalse(MeasurementPolicy.shouldMonitor(
            isAuthorized: true,
            hasValidSubscription: false,
            hasSingleApplication: true,
            hasPendingMutation: false
        ))
        XCTAssertFalse(MeasurementPolicy.shouldMonitor(
            isAuthorized: true,
            hasValidSubscription: true,
            hasSingleApplication: true,
            hasPendingMutation: true
        ))
    }

    @MainActor
    func testAuthorizationResynchronizationStopsOnRevokeAndRestartsOnRegrant() throws {
        var isAuthorized = true
        let selection = FamilyActivitySelection()
        let mapping = SubscriptionMapping(
            subscriptionId: "synthetic-sub",
            activityName: "sub_synthetic-sub",
            selection: try JSONEncoder().encode(selection)
        )
        let scheduler = RecordingMonitoringScheduler()
        let session = MeasurementSession(
            scheduler: scheduler,
            mappingStore: SyntheticMappingStore(mappings: [mapping]),
            isAuthorized: { isAuthorized },
            isStoredSelectionValid: { _ in true }
        )
        session.load(subscriptionId: "synthetic-sub")
        XCTAssertTrue(session.isMonitoring)

        isAuthorized = false
        session.authorizationDidChange()
        XCTAssertFalse(session.isMonitoring)
        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-sub"])

        isAuthorized = true
        session.authorizationDidChange()
        XCTAssertTrue(session.isMonitoring)
        XCTAssertEqual(scheduler.activeActivities, ["sub_synthetic-sub"])
    }

    func testMeasurementMutationStorePersistsAndRemovesPendingOperation() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("subbuddy-measurement-mutation-synthetic", isDirectory: true)
        try? FileManager.default.removeItem(at: directory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let fileURL = directory.appendingPathComponent("mutations.json")
        let store = MeasurementMutationStore(fileURL: fileURL)
        let mutation = MeasurementMutation(
            subscriptionId: "synthetic-subscription",
            oldActivityName: "sub_synthetic-subscription",
            replacementSelection: Data([0x01, 0x02]),
            operation: .replace
        )

        XCTAssertTrue(store.save(mutation))
        XCTAssertEqual(store.mutation(for: "synthetic-subscription"), mutation)
        XCTAssertEqual(store.pendingSubscriptionIDs(), ["synthetic-subscription"])
        XCTAssertTrue(store.remove(subscriptionId: "synthetic-subscription"))
        XCTAssertTrue(store.pendingSubscriptionIDs().isEmpty)
    }

    @MainActor
    func testMeasurementLoadStopsOrphanedActivityWithoutSavedMapping() {
        let scheduler = RecordingMonitoringScheduler(activeActivities: ["sub_synthetic-sub"])
        let mappings = SyntheticMappingStore()
        let session = MeasurementSession(scheduler: scheduler, mappingStore: mappings)

        session.load(subscriptionId: "synthetic-sub")

        XCTAssertFalse(session.isMonitoring)
        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-sub"])
        XCTAssertTrue(session.statusMessage.contains("設定がないため計測を停止"))
    }

    @MainActor
    func testMeasurementLoadRemovesInvalidMultipleTargetLegacyMapping() throws {
        let selectionData = try JSONEncoder().encode(FamilyActivitySelection())
        let mapping = SubscriptionMapping(
            subscriptionId: "synthetic-sub",
            activityName: "sub_synthetic-sub",
            selection: selectionData
        )
        let scheduler = RecordingMonitoringScheduler(activeActivities: ["sub_synthetic-sub"])
        let mappings = SyntheticMappingStore(mappings: [mapping])
        let session = MeasurementSession(scheduler: scheduler, mappingStore: mappings)

        session.load(subscriptionId: "synthetic-sub")

        XCTAssertFalse(session.isMonitoring)
        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-sub"])
        XCTAssertEqual(mappings.removedSubscriptionIDs, ["synthetic-sub"])
        XCTAssertTrue(session.statusMessage.contains("選び直してください"))
    }

    @MainActor
    func testRemovingMeasurementConfigurationKeepsOtherActivity() async {
        let scheduler = RecordingMonitoringScheduler(activeActivities: [
            "sub_synthetic-current",
            "sub_synthetic-other",
        ])
        let mappings = SyntheticMappingStore()
        let usageStore = RecordingUsageStore()
        let mutations = SyntheticMeasurementMutationStore()
        let remote = RecordingMeasurementDataService()
        let session = MeasurementSession(
            scheduler: scheduler,
            mappingStore: mappings,
            usageStore: usageStore,
            mutationStore: mutations,
            measurementDataService: remote
        )
        session.subscriptionId = "synthetic-current"

        await session.removeConfiguration()

        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-current"])
        XCTAssertEqual(usageStore.removedActivityIDs, ["sub_synthetic-current"])
        XCTAssertEqual(mappings.removedSubscriptionIDs, ["synthetic-current"])
        XCTAssertEqual(remote.deletedSubscriptionIDs, ["synthetic-current"])
        XCTAssertTrue(mutations.pendingSubscriptionIDs().isEmpty)
        XCTAssertTrue(scheduler.activeActivities.contains("sub_synthetic-other"))
        XCTAssertTrue(session.selection.applicationTokens.isEmpty)
    }

    @MainActor
    func testMeasurementRemovalFailureKeepsPendingMutationUntilRetry() async {
        let scheduler = RecordingMonitoringScheduler(activeActivities: ["sub_synthetic-current"])
        let mappings = SyntheticMappingStore()
        let usageStore = RecordingUsageStore()
        let mutations = SyntheticMeasurementMutationStore()
        let remote = RecordingMeasurementDataService(shouldFail: true)
        let session = MeasurementSession(
            scheduler: scheduler,
            mappingStore: mappings,
            usageStore: usageStore,
            mutationStore: mutations,
            measurementDataService: remote
        )
        session.subscriptionId = "synthetic-current"

        await session.removeConfiguration()

        XCTAssertTrue(session.hasPendingMutation)
        XCTAssertTrue(mutations.pendingSubscriptionIDs().contains("synthetic-current"))
        XCTAssertTrue(usageStore.removedActivityIDs.isEmpty)
        XCTAssertTrue(mappings.removedSubscriptionIDs.isEmpty)

        remote.shouldFail = false
        await session.retryPendingMutation()

        XCTAssertFalse(session.hasPendingMutation)
        XCTAssertEqual(remote.deletedSubscriptionIDs, ["synthetic-current"])
        XCTAssertEqual(usageStore.removedActivityIDs, ["sub_synthetic-current"])
        XCTAssertEqual(mappings.removedSubscriptionIDs, ["synthetic-current"])
    }

    func testOrphanedMeasurementCleanupKeepsExistingSubscription() {
        let mappings = SyntheticMappingStore(mappings: [
            SubscriptionMapping(
                subscriptionId: "synthetic-existing",
                activityName: "sub_synthetic-existing",
                selection: Data()
            ),
            SubscriptionMapping(
                subscriptionId: "synthetic-deleted",
                activityName: "sub_synthetic-deleted",
                selection: Data()
            ),
        ])
        let scheduler = RecordingMonitoringScheduler(activeActivities: [
            "sub_synthetic-existing",
            "sub_synthetic-deleted",
        ])
        let usageStore = RecordingUsageStore(records: [
            UsageRecord(
                activityId: "sub_synthetic-existing",
                eventId: "synthetic_event_15m",
                date: "2099-01-01",
                bucket: .m15Plus,
                generatedAt: Date(timeIntervalSince1970: 0),
                sequence: 1
            ),
            UsageRecord(
                activityId: "sub_synthetic-deleted",
                eventId: "synthetic_event_15m",
                date: "2099-01-01",
                bucket: .m15Plus,
                generatedAt: Date(timeIntervalSince1970: 0),
                sequence: 1
            ),
        ])
        let cleaner = MeasurementConfigurationCleaner(
            scheduler: scheduler,
            mappingStore: mappings,
            usageStore: usageStore
        )

        cleaner.removeOrphanedConfigurations(validSubscriptionIDs: ["synthetic-existing"])

        XCTAssertEqual(mappings.removedSubscriptionIDs, ["synthetic-deleted"])
        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-deleted"])
        XCTAssertEqual(usageStore.removedActivityIDs, ["sub_synthetic-deleted"])
        XCTAssertEqual(usageStore.readAll().map(\.activityId), ["sub_synthetic-existing"])
        XCTAssertTrue(scheduler.activeActivities.contains("sub_synthetic-existing"))
    }

    func testOrphanedActivityWithoutMappingIsStoppedDuringReconciliation() {
        let scheduler = RecordingMonitoringScheduler(activeActivities: ["sub_synthetic-orphan"])
        let usageStore = RecordingUsageStore(records: [
            UsageRecord(
                activityId: "sub_synthetic-orphan",
                eventId: "synthetic_event_15m",
                date: "2099-01-01",
                bucket: .m15Plus,
                generatedAt: Date(timeIntervalSince1970: 0),
                sequence: 1
            ),
        ])
        let cleaner = MeasurementConfigurationCleaner(
            scheduler: scheduler,
            mappingStore: SyntheticMappingStore(),
            usageStore: usageStore
        )

        cleaner.removeOrphanedConfigurations(validSubscriptionIDs: [])

        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-orphan"])
        XCTAssertEqual(usageStore.removedActivityIDs, ["sub_synthetic-orphan"])
        XCTAssertTrue(scheduler.activeActivities.isEmpty)
    }

    @MainActor
    func testDeletingSubscriptionRemovesOnlyItsMeasurementConfiguration() async {
        let cleaner = RecordingMeasurementCleaner()
        let store = ProductStore(client: SyntheticProductAPI(), measurementCleaner: cleaner)
        await store.loadAll()

        let deleted = await store.delete(id: PreviewFixtures.video.id)

        XCTAssertTrue(deleted)
        XCTAssertEqual(cleaner.removedSubscriptionIDs, [PreviewFixtures.video.id])
    }

    @MainActor
    func testMeasurementDataServiceUsesInjectedProductAPI() async throws {
        let api = SyntheticProductAPI()
        let store = ProductStore(client: api)
        let service = store.makeMeasurementDataService()

        try await service.deleteMeasurementData(subscriptionId: "synthetic-sub")

        let deletedSubscriptionIDs = await api.deletedMeasurementSubscriptionIDs()
        XCTAssertEqual(deletedSubscriptionIDs, ["synthetic-sub"])
    }

    @MainActor
    func testAutomaticUsageSyncSkipsSignedOutSession() async {
        let service = RecordingUsageSyncService(outcome: .success(1))
        let defaults = makeSyntheticSyncDefaults()
        let coordinator = UsageAutoSyncCoordinator(syncService: service, defaults: defaults)

        let outcome = await coordinator.syncIfEligible(isSignedIn: false)
        let callCount = await service.numberOfCalls()

        XCTAssertEqual(outcome, .skippedSignedOut)
        XCTAssertEqual(callCount, 0)
        XCTAssertEqual(defaults.double(forKey: UsageSyncStatus.lastAttemptAtKey), 0)
    }

    @MainActor
    func testAutomaticUsageSyncRecordsSuccessfulAttempt() async {
        let service = RecordingUsageSyncService(outcome: .success(2))
        let defaults = makeSyntheticSyncDefaults()
        defaults.set(true, forKey: UsageSyncStatus.lastFailedKey)
        let fixedDate = Date(timeIntervalSince1970: 4_102_444_800)
        let coordinator = UsageAutoSyncCoordinator(
            syncService: service,
            defaults: defaults,
            now: { fixedDate }
        )

        let outcome = await coordinator.syncIfEligible(isSignedIn: true)
        let callCount = await service.numberOfCalls()

        XCTAssertEqual(outcome, .succeeded(2))
        XCTAssertEqual(callCount, 1)
        XCTAssertEqual(
            defaults.double(forKey: UsageSyncStatus.lastSuccessAtKey),
            fixedDate.timeIntervalSince1970
        )
        XCTAssertFalse(defaults.bool(forKey: UsageSyncStatus.lastFailedKey))
    }

    @MainActor
    func testAutomaticUsageSyncKeepsRetryableFailureState() async {
        let service = RecordingUsageSyncService(outcome: .failure)
        let defaults = makeSyntheticSyncDefaults()
        let fixedDate = Date(timeIntervalSince1970: 4_102_444_801)
        let coordinator = UsageAutoSyncCoordinator(
            syncService: service,
            defaults: defaults,
            now: { fixedDate }
        )

        let outcome = await coordinator.syncIfEligible(isSignedIn: true)

        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(defaults.double(forKey: UsageSyncStatus.lastSuccessAtKey), 0)
        XCTAssertEqual(
            defaults.double(forKey: UsageSyncStatus.lastAttemptAtKey),
            fixedDate.timeIntervalSince1970
        )
        XCTAssertTrue(defaults.bool(forKey: UsageSyncStatus.lastFailedKey))
    }

    @MainActor
    func testAutomaticUsageSyncSuppressesConcurrentAttempt() async {
        let service = RecordingUsageSyncService(outcome: .success(1), delayNanoseconds: 50_000_000)
        let coordinator = UsageAutoSyncCoordinator(
            syncService: service,
            defaults: makeSyntheticSyncDefaults()
        )

        let firstTask = Task { @MainActor in
            await coordinator.syncIfEligible(isSignedIn: true)
        }
        while !coordinator.isSyncing { await Task.yield() }
        let second = await coordinator.syncIfEligible(isSignedIn: true)
        let firstOutcome = await firstTask.value
        let callCount = await service.numberOfCalls()

        XCTAssertEqual(second, .skippedInProgress)
        XCTAssertEqual(firstOutcome, .succeeded(1))
        XCTAssertEqual(callCount, 1)
    }

    func testUsageSyncExcludesPendingMeasurementMutation() {
        let mappings = SyntheticMappingStore(mappings: [
            SubscriptionMapping(
                subscriptionId: "synthetic-safe",
                activityName: "sub_synthetic-safe",
                selection: Data()
            ),
            SubscriptionMapping(
                subscriptionId: "synthetic-pending",
                activityName: "sub_synthetic-pending",
                selection: Data()
            ),
        ])
        let records = [
            UsageRecord(
                activityId: "sub_synthetic-safe",
                eventId: "synthetic_safe_15m",
                date: "2099-01-01",
                bucket: .m15Plus,
                generatedAt: Date(timeIntervalSince1970: 0),
                sequence: 1
            ),
            UsageRecord(
                activityId: "sub_synthetic-pending",
                eventId: "synthetic_pending_30m",
                date: "2099-01-01",
                bucket: .m30Plus,
                generatedAt: Date(timeIntervalSince1970: 0),
                sequence: 1
            ),
        ]

        let mapped = UsageSyncService.mappedRecords(
            records: records,
            mappingStore: mappings,
            pendingSubscriptionIDs: ["synthetic-pending"]
        )

        XCTAssertEqual(mapped.map { $0.1.subscriptionId }, ["synthetic-safe"])
        XCTAssertEqual(mapped.map { $0.1.date }, ["2099-01-01"])
        XCTAssertEqual(mapped.map { $0.1.usageBucket }, ["15m_plus"])
    }

    private func makeSyntheticSyncDefaults() -> UserDefaults {
        let suiteName = "SubBuddy.ProductUITests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        return defaults
    }
}

private final class RecordingMonitoringScheduler: MonitoringScheduling {
    private(set) var stoppedActivities: [String] = []
    var activeActivities: [String]

    init(activeActivities: [String] = []) {
        self.activeActivities = activeActivities
    }

    func startMonitoring(activityName: String, selection: FamilyActivitySelection) throws {
        if !activeActivities.contains(activityName) {
            activeActivities.append(activityName)
        }
    }

    func stopMonitoring(activityName: String) {
        stoppedActivities.append(activityName)
        activeActivities.removeAll { $0 == activityName }
    }
}

private final class SyntheticMappingStore: SubscriptionMappingStoring {
    private var mappings: [SubscriptionMapping]
    private(set) var removedSubscriptionIDs: [String] = []

    init(mappings: [SubscriptionMapping] = []) {
        self.mappings = mappings
    }

    func save(_ mapping: SubscriptionMapping) -> Bool {
        mappings.removeAll { $0.subscriptionId == mapping.subscriptionId }
        mappings.append(mapping)
        return true
    }

    func mapping(for subscriptionId: String) -> SubscriptionMapping? {
        mappings.first { $0.subscriptionId == subscriptionId }
    }

    func conflictingSubscriptionId(
        for selection: FamilyActivitySelection,
        excluding subscriptionId: String
    ) -> String? {
        nil
    }

    func remove(subscriptionId: String) -> Bool {
        removedSubscriptionIDs.append(subscriptionId)
        mappings.removeAll { $0.subscriptionId == subscriptionId }
        return true
    }

    func activityName(for subscriptionId: String) -> String {
        "sub_\(subscriptionId)"
    }

    func subscriptionId(for activityName: String) -> String? {
        mappings.first { $0.activityName == activityName }?.subscriptionId
    }

    func subscriptionIDs() -> [String] {
        mappings.map(\.subscriptionId)
    }

    func invalidOrDuplicateSubscriptionIDs() -> [String] {
        []
    }
}

private final class RecordingUsageStore: UsageRecordStoring {
    private var records: [UsageRecord]
    private(set) var removedActivityIDs: [String] = []

    init(records: [UsageRecord] = []) {
        self.records = records
    }

    func readAll() -> [UsageRecord] {
        records
    }

    func remove(activityId: String) -> Bool {
        removedActivityIDs.append(activityId)
        records.removeAll { $0.activityId == activityId }
        return true
    }
}

private final class SyntheticMeasurementMutationStore: MeasurementMutationStoring {
    private var mutations: [String: MeasurementMutation] = [:]

    func mutation(for subscriptionId: String) -> MeasurementMutation? {
        mutations[subscriptionId]
    }

    func pendingSubscriptionIDs() -> Set<String> {
        Set(mutations.keys)
    }

    func save(_ mutation: MeasurementMutation) -> Bool {
        mutations[mutation.subscriptionId] = mutation
        return true
    }

    func remove(subscriptionId: String) -> Bool {
        mutations.removeValue(forKey: subscriptionId)
        return true
    }
}

private final class RecordingMeasurementDataService: MeasurementDataDeleting {
    private(set) var deletedSubscriptionIDs: [String] = []
    var shouldFail: Bool

    init(shouldFail: Bool = false) {
        self.shouldFail = shouldFail
    }

    func deleteMeasurementData(subscriptionId: String) async throws {
        if shouldFail { throw APIError.invalidResponse }
        deletedSubscriptionIDs.append(subscriptionId)
    }
}

private final class RecordingMeasurementCleaner: MeasurementConfigurationCleaning {
    private(set) var removedSubscriptionIDs: [String] = []

    func removeConfiguration(subscriptionId: String) {
        removedSubscriptionIDs.append(subscriptionId)
    }

    func removeOrphanedConfigurations(validSubscriptionIDs: Set<String>) {}
    func reconcileConfigurations(validSubscriptionIDs: Set<String>) {}
}

private final class NoopMeasurementCleaner: MeasurementConfigurationCleaning {
    func removeConfiguration(subscriptionId: String) {}
    func removeOrphanedConfigurations(validSubscriptionIDs: Set<String>) {}
    func reconcileConfigurations(validSubscriptionIDs: Set<String>) {}
}

private actor ExistingSubscriptionProductAPI: ProductAPIProviding {
    enum Result: Sendable {
        case populated
        case empty
        case failure
        case reauthenticationRequired
    }

    let result: Result

    init(result: Result) {
        self.result = result
    }

    func subscriptions() async throws -> [Subscription] {
        switch result {
        case .populated:
            return [PreviewFixtures.video]
        case .empty:
            return []
        case .failure:
            throw SyntheticAPIError.unused
        case .reauthenticationRequired:
            throw APIError.reauthenticationRequired
        }
    }

    func dashboardSummary() async throws -> DashboardSummary { throw SyntheticAPIError.unused }
    func spendingSummary() async throws -> SpendingSummary { throw SyntheticAPIError.unused }
    func recommendations() async throws -> RecommendationCollection { throw SyntheticAPIError.unused }
    func upcomingRenewals(days: Int) async throws -> [UpcomingRenewal] { throw SyntheticAPIError.unused }
    func serviceCatalog() async throws -> [ServiceCatalogItem] { throw SyntheticAPIError.unused }
    func sessions() async throws -> [UserSession] { throw SyntheticAPIError.unused }
    func createSubscription(_ input: SubscriptionInput) async throws -> Subscription { throw SyntheticAPIError.unused }
    func updateSubscription(id: String, input: SubscriptionInput) async throws -> Subscription { throw SyntheticAPIError.unused }
    func deleteSubscription(id: String) async throws { throw SyntheticAPIError.unused }
    func deleteMeasurementData(subscriptionId: String) async throws {
        throw SyntheticAPIError.unused
    }
    func recomputeRecommendations() async throws { throw SyntheticAPIError.unused }
    func revokeSession(id: String) async throws { throw SyntheticAPIError.unused }
}

private actor SyntheticProductAPI: ProductAPIProviding {
    private var measurementDeletionIDs: [String] = []
    private var guidance = GuidanceProgress.empty
    private let guidanceShouldFail: Bool
    private let blockedItems: [BlockedRecommendation]

    init(
        guidanceShouldFail: Bool = false,
        blockedItems: [BlockedRecommendation] = []
    ) {
        self.guidanceShouldFail = guidanceShouldFail
        self.blockedItems = blockedItems
    }

    func dashboardSummary() async throws -> DashboardSummary {
        DashboardSummary(activeCount: 1, totalCount: 1, monthlyTotal: 1_000, yearlyTotal: 12_000, currency: "JPY")
    }

    func spendingSummary() async throws -> SpendingSummary {
        SpendingSummary(monthlyTotal: 1_000, yearlyTotal: 12_000, activeCount: 1, byCategory: [], monthlyTrend: [])
    }

    func subscriptions() async throws -> [Subscription] { [PreviewFixtures.video] }
    func recommendations() async throws -> RecommendationCollection {
        RecommendationCollection(
            items: blockedItems.isEmpty ? [PreviewFixtures.videoReview] : [],
            blockedItems: blockedItems
        )
    }
    func upcomingRenewals(days: Int) async throws -> [UpcomingRenewal] { [] }
    func serviceCatalog() async throws -> [ServiceCatalogItem] { [] }
    func sessions() async throws -> [UserSession] { [] }

    func createSubscription(_ input: SubscriptionInput) async throws -> Subscription {
        throw SyntheticAPIError.unused
    }

    func updateSubscription(id: String, input: SubscriptionInput) async throws -> Subscription {
        throw SyntheticAPIError.unused
    }

    func deleteSubscription(id: String) async throws {}
    func deleteMeasurementData(subscriptionId: String) async throws {
        measurementDeletionIDs.append(subscriptionId)
    }
    func deletedMeasurementSubscriptionIDs() -> [String] { measurementDeletionIDs }
    func recomputeRecommendations() async throws {}
    func revokeSession(id: String) async throws {}
    func guidanceProgress() async throws -> GuidanceProgress { guidance }
    func recordGuidanceEvent(_ event: GuidanceEvent) async throws -> GuidanceProgress {
        if guidanceShouldFail { throw SyntheticAPIError.unused }
        guidance = guidance.applying(event)
        return guidance
    }
}

private enum SyntheticAPIError: Error {
    case unused
}

private actor RecordingUsageSyncService: UsageSyncing {
    enum Outcome {
        case success(Int)
        case failure
    }

    private let outcome: Outcome
    private let delayNanoseconds: UInt64
    private var calls = 0

    init(outcome: Outcome, delayNanoseconds: UInt64 = 0) {
        self.outcome = outcome
        self.delayNanoseconds = delayNanoseconds
    }

    func syncAll() async throws -> Int {
        calls += 1
        if delayNanoseconds > 0 {
            try await Task.sleep(nanoseconds: delayNanoseconds)
        }
        switch outcome {
        case .success(let count):
            return count
        case .failure:
            throw SyntheticAPIError.unused
        }
    }

    func numberOfCalls() -> Int { calls }
}
