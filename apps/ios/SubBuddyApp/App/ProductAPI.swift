import Foundation

protocol ProductAPIProviding: Sendable {
    func dashboardSummary() async throws -> DashboardSummary
    func spendingSummary() async throws -> SpendingSummary
    func subscriptions() async throws -> [Subscription]
    func createSubscription(_ input: SubscriptionInput) async throws -> Subscription
    func updateSubscription(id: String, input: SubscriptionInput) async throws -> Subscription
    func deleteSubscription(id: String) async throws
    func recommendations() async throws -> [Recommendation]
    func recomputeRecommendations() async throws
    func upcomingRenewals(days: Int) async throws -> [UpcomingRenewal]
    func serviceCatalog() async throws -> [ServiceCatalogItem]
    func sessions() async throws -> [UserSession]
    func revokeSession(id: String) async throws
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

    func recommendations() async throws -> [Recommendation] {
        let response: RecommendationCollection = try await sendAuthenticated(
            path: "/api/recommendations",
            method: "GET"
        )
        return response.items
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

struct RecommendationCollection: Decodable {
    let items: [Recommendation]
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
    let generatedAt: String
}

enum RecommendationDecision: String, Codable, CaseIterable, Identifiable {
    case keep
    case review
    case considerDowngrade = "consider_downgrade"
    case considerCancel = "consider_cancel"
    case strongCancelCandidate = "strong_cancel_candidate"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .keep: return "現時点では急いで確認する材料が少ない"
        case .review: return "更新前に確認したい"
        case .considerDowngrade: return "安いプランを確認したい"
        case .considerCancel: return "今確認したい"
        case .strongCancelCandidate: return "今確認したい"
        }
    }
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
