import FamilyControls
import XCTest
import UIKit
@testable import SubBuddyApp

final class ProductUITests: XCTestCase {
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

    func testRecommendationLabelsDoNotExposeInternalDecisionCodes() {
        for decision in RecommendationDecision.allCases {
            XCTAssertFalse(decision.label.contains(decision.rawValue))
            XCTAssertFalse(decision.label.isEmpty)
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
    func testMeasurementStopTargetsOnlyCurrentSubscription() {
        let scheduler = RecordingMonitoringScheduler(activeActivities: [
            "sub_synthetic-current",
            "sub_synthetic-other",
        ])
        let session = MeasurementSession(
            scheduler: scheduler,
            mappingStore: SyntheticMappingStore()
        )
        session.subscriptionId = "synthetic-current"

        session.stopMonitoring()

        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-current"])
        XCTAssertTrue(scheduler.activeActivities.contains("sub_synthetic-other"))
    }

    @MainActor
    func testRemovingMeasurementConfigurationKeepsOtherActivity() {
        let scheduler = RecordingMonitoringScheduler(activeActivities: [
            "sub_synthetic-current",
            "sub_synthetic-other",
        ])
        let mappings = SyntheticMappingStore()
        let session = MeasurementSession(scheduler: scheduler, mappingStore: mappings)
        session.subscriptionId = "synthetic-current"

        session.removeConfiguration()

        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-current"])
        XCTAssertEqual(mappings.removedSubscriptionIDs, ["synthetic-current"])
        XCTAssertTrue(scheduler.activeActivities.contains("sub_synthetic-other"))
        XCTAssertTrue(session.selection.applicationTokens.isEmpty)
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
        let cleaner = MeasurementConfigurationCleaner(
            scheduler: scheduler,
            mappingStore: mappings
        )

        cleaner.removeOrphanedConfigurations(validSubscriptionIDs: ["synthetic-existing"])

        XCTAssertEqual(mappings.removedSubscriptionIDs, ["synthetic-deleted"])
        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-deleted"])
        XCTAssertTrue(scheduler.activeActivities.contains("sub_synthetic-existing"))
    }

    func testOrphanedActivityWithoutMappingIsStoppedDuringReconciliation() {
        let scheduler = RecordingMonitoringScheduler(activeActivities: ["sub_synthetic-orphan"])
        let cleaner = MeasurementConfigurationCleaner(
            scheduler: scheduler,
            mappingStore: SyntheticMappingStore()
        )

        cleaner.removeOrphanedConfigurations(validSubscriptionIDs: [])

        XCTAssertEqual(scheduler.stoppedActivities, ["sub_synthetic-orphan"])
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

private final class RecordingMeasurementCleaner: MeasurementConfigurationCleaning {
    private(set) var removedSubscriptionIDs: [String] = []

    func removeConfiguration(subscriptionId: String) {
        removedSubscriptionIDs.append(subscriptionId)
    }

    func removeOrphanedConfigurations(validSubscriptionIDs: Set<String>) {}
}

private final class NoopMeasurementCleaner: MeasurementConfigurationCleaning {
    func removeConfiguration(subscriptionId: String) {}
    func removeOrphanedConfigurations(validSubscriptionIDs: Set<String>) {}
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
    func recommendations() async throws -> [Recommendation] { throw SyntheticAPIError.unused }
    func upcomingRenewals(days: Int) async throws -> [UpcomingRenewal] { throw SyntheticAPIError.unused }
    func serviceCatalog() async throws -> [ServiceCatalogItem] { throw SyntheticAPIError.unused }
    func sessions() async throws -> [UserSession] { throw SyntheticAPIError.unused }
    func createSubscription(_ input: SubscriptionInput) async throws -> Subscription { throw SyntheticAPIError.unused }
    func updateSubscription(id: String, input: SubscriptionInput) async throws -> Subscription { throw SyntheticAPIError.unused }
    func deleteSubscription(id: String) async throws { throw SyntheticAPIError.unused }
    func recomputeRecommendations() async throws { throw SyntheticAPIError.unused }
    func revokeSession(id: String) async throws { throw SyntheticAPIError.unused }
}

private actor SyntheticProductAPI: ProductAPIProviding {
    func dashboardSummary() async throws -> DashboardSummary {
        DashboardSummary(activeCount: 1, totalCount: 1, monthlyTotal: 1_000, yearlyTotal: 12_000, currency: "JPY")
    }

    func spendingSummary() async throws -> SpendingSummary {
        SpendingSummary(monthlyTotal: 1_000, yearlyTotal: 12_000, activeCount: 1, byCategory: [], monthlyTrend: [])
    }

    func subscriptions() async throws -> [Subscription] { [PreviewFixtures.video] }
    func recommendations() async throws -> [Recommendation] { [PreviewFixtures.videoReview] }
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
    func recomputeRecommendations() async throws {}
    func revokeSession(id: String) async throws {}
}

private enum SyntheticAPIError: Error {
    case unused
}
