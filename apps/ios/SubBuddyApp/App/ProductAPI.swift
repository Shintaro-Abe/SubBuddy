import Foundation

protocol ProductAPIProviding: Sendable {
    func dashboardSummary() async throws -> DashboardSummary
    func spendingSummary() async throws -> SpendingSummary
    func subscriptions() async throws -> [Subscription]
    func createSubscription(_ input: SubscriptionInput) async throws -> Subscription
    func updateSubscription(id: String, input: SubscriptionInput) async throws -> Subscription
    func deleteSubscription(id: String) async throws
    func deleteMeasurementData(subscriptionId: String) async throws
    func recommendations() async throws -> RecommendationCollection
    func recomputeRecommendations() async throws
    func upcomingRenewals(days: Int) async throws -> [UpcomingRenewal]
    func serviceCatalog() async throws -> [ServiceCatalogItem]
    func sessions() async throws -> [UserSession]
    func revokeSession(id: String) async throws
    func guidanceProgress() async throws -> GuidanceProgress
    func recordGuidanceEvent(_ event: GuidanceEvent) async throws -> GuidanceProgress
}

extension ProductAPIProviding {
    func guidanceProgress() async throws -> GuidanceProgress { .empty }
    func recordGuidanceEvent(_ event: GuidanceEvent) async throws -> GuidanceProgress { .empty }
}

extension APIClient {
    func dashboardSummary() async throws -> DashboardSummary {
        try await sendAuthenticated(path: "/api/summary", method: "GET")
    }

    func spendingSummary() async throws -> SpendingSummary {
        try await sendAuthenticated(path: "/api/spending/summary", method: "GET")
    }

    func subscriptions() async throws -> [Subscription] {
        let response: SubscriptionCollection = try await sendAuthenticated(
            path: "/api/subscriptions",
            method: "GET"
        )
        return response.items
    }

    func subscription(id: String) async throws -> Subscription {
        try await sendAuthenticated(path: "/api/subscriptions/\(id)", method: "GET")
    }

    func createSubscription(_ input: SubscriptionInput) async throws -> Subscription {
        try await sendAuthenticated(path: "/api/subscriptions", method: "POST", body: input)
    }

    func updateSubscription(id: String, input: SubscriptionInput) async throws -> Subscription {
        try await sendAuthenticated(path: "/api/subscriptions/\(id)", method: "PUT", body: input)
    }

    func deleteSubscription(id: String) async throws {
        let _: DeleteResponse = try await sendAuthenticated(
            path: "/api/subscriptions/\(id)",
            method: "DELETE",
            body: EmptyRequest()
        )
    }

    func deleteMeasurementData(subscriptionId: String) async throws {
        let _: DeleteResponse = try await sendAuthenticated(
            path: "/api/subscriptions/\(subscriptionId)/usage",
            method: "DELETE",
            body: EmptyRequest()
        )
    }

    func recommendations() async throws -> RecommendationCollection {
        try await sendAuthenticated(
            path: "/api/recommendations",
            method: "GET"
        )
    }

    func recomputeRecommendations() async throws {
        let _: RecomputeResponse = try await sendAuthenticated(
            path: "/api/recommendations/recompute",
            method: "POST",
            body: EmptyRequest()
        )
    }

    func upcomingRenewals(days: Int = 14) async throws -> [UpcomingRenewal] {
        let response: UpcomingRenewalCollection = try await sendAuthenticated(
            path: "/api/renewals/upcoming?days=\(days)",
            method: "GET"
        )
        return response.items
    }

    func serviceCatalog() async throws -> [ServiceCatalogItem] {
        let response: ServiceCatalogCollection = try await send(
            path: "/api/service-catalog",
            method: "GET",
            bearerToken: nil
        )
        return response.items
    }

    func sessions() async throws -> [UserSession] {
        let response: SessionCollection = try await sendAuthenticated(
            path: "/api/sessions",
            method: "GET"
        )
        return response.items
    }

    func revokeSession(id: String) async throws {
        let _: SessionRevocationResponse = try await sendAuthenticated(
            path: "/api/sessions/\(id)",
            method: "DELETE",
            body: EmptyRequest()
        )
    }

    func guidanceProgress() async throws -> GuidanceProgress {
        try await sendAuthenticated(path: "/api/guidance-progress", method: "GET")
    }

    func recordGuidanceEvent(_ event: GuidanceEvent) async throws -> GuidanceProgress {
        try await sendAuthenticated(
            path: "/api/guidance-progress",
            method: "PATCH",
            body: GuidanceEventRequest(event: event)
        )
    }

    func deleteAccount(identityToken: String, nonce: String) async throws -> Bool {
        let response: AccountDeletionResponse = try await sendAuthenticated(
            path: "/api/account",
            method: "DELETE",
            body: AccountDeletionRequest(identityToken: identityToken, nonce: nonce)
        )
        return response.deleted
    }
}

extension APIClient: ProductAPIProviding {}

enum GuidanceStep: String, Codable, CaseIterable, Hashable, Sendable {
    case inventory
    case spending
    case review
    case measurement

    var title: String {
        switch self {
        case .inventory: return "契約を棚卸しする"
        case .spending: return "支出と更新日を見る"
        case .review: return "見直す理由を見る"
        case .measurement: return "必要なら利用状況を加える"
        }
    }

    var detail: String {
        switch self {
        case .inventory: return "契約中のサブスクを、思い出せる範囲から登録します。"
        case .spending: return "登録した契約の月額・年額と更新日を確認します。"
        case .review: return "分かっている事実、不足情報、選択肢を確認します。"
        case .measurement: return "使わなくても料金や更新日から見直せます。"
        }
    }
}

enum GuidanceEvent: String, Codable, Equatable, Sendable {
    case inventoryCompleted = "inventory_completed"
    case spendingViewed = "spending_viewed"
    case reviewViewed = "review_viewed"
    case measurementConfigured = "measurement_configured"
    case measurementSkipped = "measurement_skipped"
    case measurementReset = "measurement_reset"
}

struct GuidanceEventRequest: Encodable, Sendable {
    let event: GuidanceEvent
}

struct GuidanceProgress: Decodable, Equatable, Sendable {
    struct Steps: Decodable, Equatable, Sendable {
        let inventory: Bool
        let spending: Bool
        let review: Bool
        let measurement: Bool

        func isComplete(_ step: GuidanceStep) -> Bool {
            switch step {
            case .inventory: return inventory
            case .spending: return spending
            case .review: return review
            case .measurement: return measurement
            }
        }
    }

    let steps: Steps
    let completedCount: Int
    let totalCount: Int
    let nextStep: GuidanceStep?
    let isComplete: Bool
    let measurementChoice: String

    static let empty = GuidanceProgress(
        steps: Steps(inventory: false, spending: false, review: false, measurement: false),
        completedCount: 0,
        totalCount: 4,
        nextStep: .inventory,
        isComplete: false,
        measurementChoice: "pending"
    )

    func applying(_ event: GuidanceEvent) -> GuidanceProgress {
        var inventory = steps.inventory
        var spending = steps.spending
        var review = steps.review
        var measurement = steps.measurement
        var choice = measurementChoice
        switch event {
        case .inventoryCompleted: inventory = true
        case .spendingViewed: spending = true
        case .reviewViewed: review = true
        case .measurementConfigured:
            measurement = true
            choice = "configured"
        case .measurementSkipped:
            measurement = true
            choice = "skipped"
        case .measurementReset:
            measurement = false
            choice = "pending"
        }
        let updated = Steps(
            inventory: inventory,
            spending: spending,
            review: review,
            measurement: measurement
        )
        let next = GuidanceStep.allCases.first { !updated.isComplete($0) }
        let count = GuidanceStep.allCases.filter { updated.isComplete($0) }.count
        return GuidanceProgress(
            steps: updated,
            completedCount: count,
            totalCount: 4,
            nextStep: next,
            isComplete: count == 4,
            measurementChoice: choice
        )
    }
}

struct DashboardSummary: Decodable, Equatable {
    let activeCount: Int
    let totalCount: Int
    let monthlyTotal: Int
    let yearlyTotal: Int
    let currency: String
}

struct SpendingSummary: Decodable, Equatable {
    let monthlyTotal: Int
    let yearlyTotal: Int
    let activeCount: Int
    let byCategory: [CategorySpending]
    let monthlyTrend: [MonthlySpending]
}

struct CategorySpending: Decodable, Identifiable, Equatable {
    var id: String { category }
    let category: String
    let monthly: Int
    let share: Double
}

struct MonthlySpending: Decodable, Identifiable, Equatable {
    var id: String { month }
    let month: String
    let monthly: Int
}

struct SubscriptionCollection: Decodable {
    let items: [Subscription]
}

struct Subscription: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let normalizedName: String?
    let category: String
    let amount: Int
    let currency: String
    let billingCycle: BillingCycle
    let nextRenewalDate: String?
    let signupChannel: String?
    let status: SubscriptionStatus
    let importance: Int
    let cancellationUrl: String?
    let notes: String?
    let matchedServiceId: String?
    let usageType: String
    let initialValueAnswer: String?
    let planCapacityGb: Int?
    let usedCapacityGb: Int?
    let capacityCheckedAt: String?
    let createdAt: String
    let updatedAt: String

    var monthlyAmount: Int {
        billingCycle == .monthly ? amount : Int((Double(amount) / 12.0).rounded())
    }

    var yearlyAmount: Int {
        billingCycle == .yearly ? amount : amount * 12
    }
}

enum BillingCycle: String, Codable, CaseIterable, Identifiable {
    case monthly
    case yearly

    var id: String { rawValue }
    var label: String { self == .monthly ? "月払い" : "年払い" }
}

enum SubscriptionStatus: String, Codable, CaseIterable, Identifiable {
    case active
    case paused
    case canceled

    var id: String { rawValue }
    var label: String {
        switch self {
        case .active: return "利用中"
        case .paused: return "一時停止"
        case .canceled: return "終了"
        }
    }
}

struct SubscriptionInput: Codable, Equatable {
    let name: String
    let category: String
    let amount: Int
    let currency: String
    let billingCycle: BillingCycle
    let nextRenewalDate: String?
    let importance: Int
    let cancellationUrl: String?
    let notes: String?
    let signupChannel: String?
    let status: SubscriptionStatus
    let matchedServiceId: String?
    let usageType: String
    let initialValueAnswer: String?
    let planCapacityGb: Int?
    let usedCapacityGb: Int?
    let capacityCheckedAt: String?
}

struct RecommendationCollection: Decodable, Equatable {
    let items: [Recommendation]
    let blockedItems: [BlockedRecommendation]?
}

struct BlockedRecommendation: Decodable, Equatable {
    let subscriptionId: String
    let message: String
}

struct Recommendation: Decodable, Identifiable, Equatable {
    let id: String
    let subscriptionId: String
    let decision: RecommendationDecision?
    let dataStatus: RecommendationDataStatus
    let observationDays: Int
    let daysUntilReady: Int
    let monthlyAmount: Int
    let yearlyAmount: Int
    let usageDays30d: Int
    let usageMinutes30d: Int
    let daysSinceLastUse: Int?
    let daysUntilRenewal: Int?
    let costPerUsageDay: Double?
    let hasOverlap: Bool
    let confidence: Double
    let reason: String
    let matchedPatterns: [MatchedPattern]?
    let reviewPriority: ReviewPriority
    let reviewUnknowns: [ReviewUnknown]
    let reviewOptions: [ReviewOption]
    let annualSavingsIfCancelled: Int?
    let annualSavingsIfDowngraded: Int?
    let annualSavingsIfSwitched: Int?
    let generatedAt: String
}

enum ReviewPriority: String, Codable, CaseIterable, Identifiable {
    case now
    case beforeRenewal = "before_renewal"
    case missingInformation = "missing_information"
    case lowUrgency = "low_urgency"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .now: return "今確認したい"
        case .beforeRenewal: return "更新前に確認したい"
        case .missingInformation: return "情報が不足している"
        case .lowUrgency: return "現時点では急いで確認する材料が少ない"
        }
    }
}

struct ReviewUnknown: Decodable, Equatable, Identifiable {
    let code: String
    let message: String
    var id: String { code }
}

struct ReviewOption: Decodable, Equatable, Identifiable {
    let kind: String
    let title: String
    let detail: String
    let targetName: String?
    let currentMonthlyAmount: Int?
    let targetMonthlyAmount: Int?
    let annualSavings: Int?
    let calculation: String?
    let sourceUrl: String?
    let verifiedAt: String?
    var id: String { "\(kind)-\(title)-\(targetName ?? "")" }
}

enum RecommendationDecision: String, Codable, CaseIterable, Identifiable {
    case keep
    case review
    case considerDowngrade = "consider_downgrade"
    case considerCancel = "consider_cancel"
    case strongCancelCandidate = "strong_cancel_candidate"

    var id: String { rawValue }
}

enum RecommendationDataStatus: String, Codable {
    case observing
    case ready
}

struct MatchedPattern: Decodable, Equatable, Identifiable {
    var id: String { "\(code ?? label ?? "reason")-\(detail ?? "")-\(caveat ?? "")" }
    let code: String?
    let label: String?
    let detail: String?
    let caveat: String?

    init(code: String? = nil, label: String?, detail: String?, caveat: String? = nil) {
        self.code = code
        self.label = label
        self.detail = detail
        self.caveat = caveat
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        code = try container.decodeIfPresent(String.self, forKey: .code)
            ?? container.decodeIfPresent(String.self, forKey: .pattern)
        label = try container.decodeIfPresent(String.self, forKey: .label)
            ?? container.decodeIfPresent(String.self, forKey: .title)
        detail = try container.decodeIfPresent(String.self, forKey: .detail)
            ?? container.decodeIfPresent(String.self, forKey: .reason)
            ?? container.decodeIfPresent(String.self, forKey: .evidence)
        caveat = try container.decodeIfPresent(String.self, forKey: .caveat)
    }

    enum CodingKeys: String, CodingKey {
        case code, pattern, label, title, detail, reason, evidence, caveat
    }
}

struct UpcomingRenewalCollection: Decodable {
    let days: Int
    let items: [UpcomingRenewal]
}

struct UpcomingRenewal: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let amount: Int
    let currency: String
    let billingCycle: BillingCycle
    let nextRenewalDate: String?
    let daysUntilRenewal: Int
}

struct ServiceCatalogCollection: Decodable {
    let items: [ServiceCatalogItem]
}

struct ServiceCatalogItem: Decodable, Identifiable, Equatable {
    let id: String
    let canonicalName: String
    let category: String
    let cancellationUrl: String?
    let isSupported: Bool
    let isExcluded: Bool
    let usageType: String
}

struct SessionCollection: Decodable {
    let items: [UserSession]
}

struct UserSession: Decodable, Identifiable, Equatable {
    let id: String
    let clientType: String
    let deviceName: String?
    let createdAt: String
    let lastUsedAt: String
    let current: Bool?
}

struct DeleteResponse: Codable { let deleted: Bool }
struct RecomputeResponse: Codable { let recomputed: Int }
struct SessionRevocationResponse: Codable { let revoked: Bool }
struct AccountDeletionRequest: Codable { let identityToken: String; let nonce: String }
struct AccountDeletionResponse: Codable { let deleted: Bool }
