import Combine
import Foundation

enum ExistingSubscriptionLoadOutcome: Equatable {
    case populated
    case empty
    case failed
}

@MainActor
final class ProductStore: ObservableObject {
    @Published private(set) var subscriptions: [Subscription] = []
    @Published private(set) var recommendations: [Recommendation] = []
    @Published private(set) var upcomingRenewals: [UpcomingRenewal] = []
    @Published private(set) var catalog: [ServiceCatalogItem] = []
    @Published private(set) var sessions: [UserSession] = []
    @Published private(set) var dashboard: DashboardSummary?
    @Published private(set) var spending: SpendingSummary?
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?
    @Published private(set) var requiresReauthentication = false
    @Published private(set) var lastUpdatedAt: Date?

    private var client: (any ProductAPIProviding)?
    private var clientBaseURL: URL?
    private let usesInjectedClient: Bool
    private let measurementCleaner: any MeasurementConfigurationCleaning

    init(
        client: (any ProductAPIProviding)? = nil,
        previewSnapshot: ProductPreviewSnapshot? = nil,
        measurementCleaner: any MeasurementConfigurationCleaning = MeasurementConfigurationCleaner()
    ) {
        self.client = client
        self.measurementCleaner = measurementCleaner
        usesInjectedClient = client != nil
        guard let previewSnapshot else { return }
        subscriptions = previewSnapshot.subscriptions
        recommendations = previewSnapshot.recommendations
        upcomingRenewals = previewSnapshot.upcomingRenewals
        dashboard = previewSnapshot.dashboard
        spending = previewSnapshot.spending
        lastUpdatedAt = previewSnapshot.updatedAt
        errorMessage = previewSnapshot.errorMessage
    }

    var hasConfiguredAPI: Bool { AppConstants.apiBaseURL != nil }

    func loadExistingSubscriptions() async -> ExistingSubscriptionLoadOutcome {
        guard let client = configuredClient() else {
            errorMessage = "接続先が設定されていません。配布用ビルドの設定を確認してください。（参照: CONFIG）"
            return .failed
        }
        guard !isLoading else { return .failed }
        isLoading = true
        errorMessage = nil
        requiresReauthentication = false
        defer { isLoading = false }

        do {
            subscriptions = try await client.subscriptions()
            measurementCleaner.reconcileConfigurations(
                validSubscriptionIDs: Set(subscriptions.map(\.id))
            )
            lastUpdatedAt = Date()
            return subscriptions.isEmpty ? .empty : .populated
        } catch {
            handleSubscriptionLoadError(error)
            return .failed
        }
    }

    func loadAll() async {
        guard let client = configuredClient() else {
            errorMessage = "接続先が設定されていません。配布用ビルドの設定を確認してください。"
            return
        }
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        requiresReauthentication = false
        defer { isLoading = false }

        do {
            async let subscriptions = client.subscriptions()
            async let dashboard = client.dashboardSummary()
            async let spending = client.spendingSummary()
            async let recommendations = client.recommendations()
            async let upcoming = client.upcomingRenewals(days: 14)
            async let catalog = client.serviceCatalog()

            self.subscriptions = try await subscriptions
            measurementCleaner.reconcileConfigurations(
                validSubscriptionIDs: Set(self.subscriptions.map(\.id))
            )
            self.dashboard = try await dashboard
            self.spending = try await spending
            self.recommendations = try await recommendations
            self.upcomingRenewals = try await upcoming
            self.catalog = try await catalog
            lastUpdatedAt = Date()
        } catch {
            handle(error)
        }
    }

    func loadSessions() async {
        guard let client = configuredClient() else { return }
        do {
            sessions = try await client.sessions()
        } catch {
            handle(error)
        }
    }

    func save(input: SubscriptionInput, id: String? = nil) async -> Bool {
        guard let client = configuredClient(), !isSaving else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            if let id {
                _ = try await client.updateSubscription(id: id, input: input)
            } else {
                _ = try await client.createSubscription(input)
            }
            await loadAll()
            return errorMessage == nil
        } catch {
            handle(error)
            return false
        }
    }

    func delete(id: String) async -> Bool {
        guard let client = configuredClient(), !isSaving else { return false }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await client.deleteSubscription(id: id)
            measurementCleaner.removeConfiguration(subscriptionId: id)
            subscriptions.removeAll { $0.id == id }
            await loadAll()
            return errorMessage == nil
        } catch {
            handle(error)
            return false
        }
    }

    func recompute() async {
        guard let client = configuredClient(), !isSaving else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await client.recomputeRecommendations()
            recommendations = try await client.recommendations()
        } catch {
            handle(error)
        }
    }

    func revokeSession(id: String) async {
        guard let client = configuredClient() else { return }
        do {
            try await client.revokeSession(id: id)
            await loadSessions()
        } catch {
            handle(error)
        }
    }

    func subscription(id: String) -> Subscription? {
        subscriptions.first { $0.id == id }
    }

    func recommendation(for subscriptionId: String) -> Recommendation? {
        recommendations.first { $0.subscriptionId == subscriptionId }
    }

    func reconcileMeasurements() {
        measurementCleaner.reconcileConfigurations(
            validSubscriptionIDs: Set(subscriptions.map(\.id))
        )
    }

    func makeMeasurementDataService() -> any MeasurementDataDeleting {
        guard let client = configuredClient() as? APIClient else {
            return MeasurementDataService()
        }
        return MeasurementDataService(client: client)
    }

    func clearSensitiveData() {
        subscriptions = []
        recommendations = []
        upcomingRenewals = []
        catalog = []
        sessions = []
        dashboard = nil
        spending = nil
        lastUpdatedAt = nil
        errorMessage = nil
        requiresReauthentication = false
    }

    private func configuredClient() -> (any ProductAPIProviding)? {
        if usesInjectedClient { return client }
        guard let baseURL = AppConstants.apiBaseURL else { return nil }
        if baseURL == clientBaseURL, let client { return client }
        let newClient = APIClient(baseURL: baseURL)
        client = newClient
        clientBaseURL = baseURL
        return newClient
    }

    private func handle(_ error: Error) {
        if let apiError = error as? APIError, case .reauthenticationRequired = apiError {
            requiresReauthentication = true
            errorMessage = "安全のため、Appleで再認証してください。"
        } else {
            errorMessage = "通信できませんでした。入力内容はそのままにして、もう一度お試しください。"
        }
    }

    private func handleSubscriptionLoadError(_ error: Error) {
        if let apiError = error as? APIError {
            switch apiError {
            case .reauthenticationRequired, .httpStatus(401), .httpStatus(403):
                requiresReauthentication = true
                errorMessage = "ログイン状態を確認できませんでした。Appleで再認証してください。（参照: AUTH）"
            case .httpStatus(let statusCode) where statusCode >= 500:
                errorMessage = "サーバーで契約を読み込めませんでした。しばらく待ってから、もう一度お試しください。（参照: HTTP-\(statusCode)）"
            case .httpStatus(let statusCode):
                errorMessage = "契約APIから正常な応答を受け取れませんでした。（参照: HTTP-\(statusCode)）"
            case .invalidURL:
                errorMessage = "接続先の設定を確認できませんでした。（参照: URL）"
            case .invalidResponse:
                errorMessage = "契約APIの応答を確認できませんでした。（参照: RESPONSE）"
            }
            return
        }

        if error is DecodingError {
            errorMessage = "アプリとサーバーのデータ形式が一致していません。（参照: DECODE）"
        } else if error is URLError {
            errorMessage = "サーバーへ接続できませんでした。通信状況を確認してください。（参照: NETWORK）"
        } else {
            errorMessage = "契約を読み込めませんでした。もう一度お試しください。（参照: UNKNOWN）"
        }
    }
}

struct ProductPreviewSnapshot {
    let subscriptions: [Subscription]
    let recommendations: [Recommendation]
    let upcomingRenewals: [UpcomingRenewal]
    let dashboard: DashboardSummary?
    let spending: SpendingSummary?
    var updatedAt: Date? = Date()
    var errorMessage: String? = nil
}
