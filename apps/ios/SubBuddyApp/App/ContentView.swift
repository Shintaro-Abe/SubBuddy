import AuthenticationServices
import Foundation
import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var authSession = AuthSession()
    @StateObject private var productStore = ProductStore()
    @StateObject private var usageAutoSync = UsageAutoSyncCoordinator()
    @AppStorage("has_seen_intro") private var hasSeenIntro = false
    @AppStorage("onboarding_completed") private var onboardingCompleted = false

    var body: some View {
        Group {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-subbuddy-quality-200") {
                SyntheticQualityRootView()
            } else {
                appContent
            }
            #else
            appContent
            #endif
        }
        .tint(AppColor.controlTint)
        .environment(\.font, .appBody)
        .background(AppColor.background.ignoresSafeArea())
        .onChange(of: authSession.isSignedIn) { _, isSignedIn in
            if !isSignedIn {
                productStore.clearSensitiveData()
            } else {
                Task { _ = await usageAutoSync.syncIfEligible(isSignedIn: true) }
            }
        }
        .onChange(of: productStore.requiresReauthentication) { _, requiresReauthentication in
            if requiresReauthentication { authSession.requireReauthentication() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, authSession.isSignedIn {
                productStore.reconcileMeasurements()
                Task { _ = await usageAutoSync.syncIfEligible(isSignedIn: true) }
            }
        }
        .task {
            _ = await usageAutoSync.syncIfEligible(isSignedIn: authSession.isSignedIn)
        }
    }

    @ViewBuilder
    private var appContent: some View {
        Group {
            if !hasSeenIntro {
                IntroView {
                    hasSeenIntro = true
                }
            } else if !authSession.isSignedIn {
                SignInView(authSession: authSession)
            } else if !onboardingCompleted {
                OnboardingFlowView(
                    store: productStore,
                    reauthenticate: authSession.requireReauthentication
                ) {
                    onboardingCompleted = true
                }
            } else {
                MainTabView(authSession: authSession, store: productStore)
            }
        }
    }
}

#if DEBUG
private struct SyntheticQualityRootView: View {
    @StateObject private var authSession = AuthSession()
    @StateObject private var productStore = ProductStore(previewSnapshot: PreviewFixtures.twoHundred)

    var body: some View {
        MainTabView(authSession: authSession, store: productStore)
    }
}
#endif

struct IntroView: View {
    let continueAction: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.xLarge) {
                Spacer(minLength: AppSpacing.section)
                Text("SubBuddy")
                    .font(.appDisplay)
                Text("契約と支出を静かに整理し、次に確認することを見つけます。")
                    .font(.appTitle2)
                    .accessibilityAddTraits(.isHeader)

                ReviewCard {
                    VStack(alignment: .leading, spacing: AppSpacing.medium) {
                        Label("判断はあなた自身が行います", systemImage: "checkmark.seal")
                            .font(.appHeadline)
                        Text("SubBuddyは、分かっている事実と分からない点を示します。継続や解約を自動で決めません。")
                    }
                }

                VStack(alignment: .leading, spacing: AppSpacing.large) {
                    TrustPoint(icon: "lock.shield", title: "保存するもの", detail: "登録した契約、支出の集計、見直し結果を本人のアカウントに保存します。")
                    TrustPoint(icon: "iphone", title: "端末内に残すもの", detail: "Screen Timeで選んだアプリの情報はiPhone内だけに残します。")
                    TrustPoint(icon: "chart.bar", title: "送る利用情報", detail: "利用したかどうかと時間帯の集計値だけを送ります。詳細な操作履歴は送りません。")
                }

                Button("内容を確認して続ける", action: continueAction)
                    .appProminentButtonStyle()
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                    .accessibilityHint("Appleサインインの画面へ進みます")
            }
            .padding(AppSpacing.large)
        }
    }
}

private struct TrustPoint: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.medium) {
            Image(systemName: icon)
                .frame(width: 28, height: 28)
                .foregroundStyle(AppColor.accent)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                Text(title).font(.appHeadline)
                Text(detail).font(.appSubheadline).foregroundStyle(AppColor.secondaryText)
            }
        }
    }
}

struct SignInView: View {
    @ObservedObject var authSession: AuthSession

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.large) {
            Spacer()
            Text("おかえりなさい")
                .font(.appDisplay)
            Text("契約情報を安全に読み込むため、Appleでサインインします。氏名とApple提供メールは保存しません。")
                .foregroundStyle(AppColor.secondaryText)

            SignInWithAppleButton(.signIn) { request in
                authSession.prepareAppleAuthorizationRequest(request)
            } onCompletion: { result in
                Task {
                    switch result {
                    case .success(let authorization):
                        await authSession.handleAppleAuthorization(authorization)
                    case .failure(let error):
                        authSession.handleAppleAuthorizationError(error)
                    }
                }
            }
            .signInWithAppleButtonStyle(.black)
            .appAppleSignInButtonSize()
            .disabled(authSession.isWorking || AppConstants.apiBaseURL == nil)

            if AppConstants.apiBaseURL == nil {
                Label("配布用の接続設定がありません。アプリのビルド設定を確認してください。", systemImage: "exclamationmark.triangle")
                    .font(.appFootnote)
                    .foregroundStyle(AppColor.caution)
            } else if authSession.statusMessage != "サインインしていません" {
                Text(authSession.statusMessage)
                    .font(.appFootnote)
                    .foregroundStyle(AppColor.secondaryText)
            }
            Spacer()
        }
        .padding(AppSpacing.large)
    }
}
struct OnboardingFlowView: View {
    @ObservedObject var store: ProductStore
    let reauthenticate: () -> Void
    let complete: () -> Void
    @State private var path: [OnboardingStep] = []
    @State private var existingLoadMessage: String?
    @State private var didRestoreProgress = false

    enum OnboardingStep: Hashable {
        case firstContract
        case result
        case inventory
        case measurement
        case review
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.large) {
                    Spacer(minLength: AppSpacing.section)
                    Text("まず1件だけ\n登録しましょう")
                        .font(.appDisplay)
                        .accessibilityAddTraits(.isHeader)
                    Text("よく使うサービスを1件登録すると、月額と年額の目安をすぐ確認できます。すべてを一度に入力する必要はありません。")
                        .foregroundStyle(AppColor.secondaryText)
                    Button("最初の契約を登録") { path.append(.firstContract) }
                        .appProminentButtonStyle()
                        .controlSize(.large)
                    Button("登録済みの契約を読み込む") {
                        loadExistingSubscriptions()
                    }
                    .buttonStyle(.bordered)
                    .disabled(store.isLoading)

                    if store.isLoading {
                        ProgressView("契約を読み込んでいます")
                    } else if let error = store.errorMessage {
                        InlineErrorView(message: error, retry: loadExistingSubscriptions)
                    } else if let existingLoadMessage {
                        Label(existingLoadMessage, systemImage: "info.circle")
                            .font(.appFootnote)
                            .foregroundStyle(AppColor.secondaryText)
                    }
                }
                .padding(AppSpacing.large)
            }
            .navigationDestination(for: OnboardingStep.self) { step in
                switch step {
                case .firstContract:
                    SubscriptionFormView(store: store, mode: .create) {
                        path.append(.result)
                    }
                case .result:
                    FirstValueView(store: store) {
                        path.append(.inventory)
                    } skip: {
                        Task {
                            await store.recordGuidanceEvent(.inventoryCompleted)
                            path.append(.review)
                        }
                    }
                case .inventory:
                    InventoryContinuationView(store: store) {
                        Task {
                            await store.recordGuidanceEvent(.inventoryCompleted)
                            path.append(.review)
                        }
                    }
                case .review:
                    FirstReviewView(store: store) {
                        path.append(.measurement)
                    }
                case .measurement:
                    MeasurementExplanationView(configureLater: complete) {
                        Task {
                            await store.recordGuidanceEvent(.measurementSkipped)
                            complete()
                        }
                    }
                }
            }
        }
        .task {
            guard !didRestoreProgress else { return }
            didRestoreProgress = true
            await store.loadAll()
            if store.guidanceProgress.isComplete {
                complete()
                return
            }
            guard !store.subscriptions.isEmpty else { return }
            switch store.guidanceProgress.nextStep {
            case .inventory, .spending:
                path = [.result]
            case .review:
                path = [.review]
            case .measurement:
                path = [.measurement]
            case nil:
                complete()
            }
        }
    }

    private func loadExistingSubscriptions() {
        existingLoadMessage = nil
        Task {
            switch await store.loadExistingSubscriptions() {
            case .populated:
                path.append(.result)
            case .empty:
                existingLoadMessage = "このAppleアカウントに登録済みの契約は見つかりませんでした。Web版と同じAppleアカウントか確認してください。"
            case .failed:
                if store.requiresReauthentication { reauthenticate() }
            }
        }
    }
}

struct FirstValueView: View {
    @ObservedObject var store: ProductStore
    let continueInventory: () -> Void
    let skip: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.large) {
                Text("最初の全体像")
                    .font(.appDisplay)
                SurfaceCard {
                    VStack(alignment: .leading, spacing: AppSpacing.small) {
                        Text("登録中の年間支出（目安）")
                            .font(.appCaption)
                            .foregroundStyle(AppColor.secondaryText)
                        Text(AppFormatters.yen(store.dashboard?.yearlyTotal ?? store.subscriptions.reduce(0) { $0 + $1.yearlyAmount }))
                            .font(.appMoney)
                            .minimumScaleFactor(0.65)
                            .accessibilityLabel("登録中の年間支出の目安")
                    }
                }
                Text("これは登録済みの契約だけを含む目安です。あとから契約を追加したり、分からない情報を補ったりできます。")
                    .font(.appSubheadline)
                    .foregroundStyle(AppColor.secondaryText)
                Button("棚卸しを続ける", action: continueInventory)
                    .appProminentButtonStyle()
                    .controlSize(.large)
                Button("今は1件で始める", action: skip)
                    .buttonStyle(.bordered)
            }
            .padding(AppSpacing.large)
        }
        .task {
            await store.loadAll()
            await store.recordGuidanceEvent(.spendingViewed)
        }
    }
}

struct InventoryContinuationView: View {
    @ObservedObject var store: ProductStore
    let next: () -> Void
    @State private var selectedCategory: InventoryCategory?

    private let categories = [
        InventoryCategory(name: "動画", value: "video_streaming", icon: "play.rectangle"),
        InventoryCategory(name: "音楽", value: "music", icon: "music.note"),
        InventoryCategory(name: "クラウド", value: "cloud_storage", icon: "icloud"),
        InventoryCategory(name: "仕事", value: "productivity", icon: "briefcase"),
        InventoryCategory(name: "学習", value: "learning", icon: "book")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.large) {
                Text("ほかの契約も\n思い出せる範囲で")
                    .font(.appDisplay)
                Text("当てはまるカテゴリだけ確認できます。該当しないものは飛ばして構いません。")
                    .foregroundStyle(AppColor.secondaryText)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: AppSpacing.small) {
                    ForEach(categories) { category in
                        Button {
                            selectedCategory = category
                        } label: {
                            Label(category.name, systemImage: category.icon)
                                .frame(maxWidth: .infinity, minHeight: 52)
                        }
                        .buttonStyle(.bordered)
                    }
                }

                if !store.subscriptions.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.small) {
                        Text("登録済み").font(.appHeadline)
                        ForEach(store.subscriptions) { item in
                            HStack {
                                Text(item.name)
                                Spacer()
                                Text(AppFormatters.yen(item.amount)).foregroundStyle(AppColor.secondaryText)
                            }
                            .padding(.vertical, AppSpacing.xSmall)
                        }
                    }
                }

                Button("棚卸しを終えて次へ", action: next)
                    .appProminentButtonStyle()
                    .controlSize(.large)
            }
            .padding(AppSpacing.large)
        }
        .sheet(item: $selectedCategory) { category in
            NavigationStack {
                SubscriptionFormView(
                    store: store,
                    mode: .create,
                    initialCategory: category.value
                ) {
                    selectedCategory = nil
                }
            }
        }
    }
}

struct InventoryCategory: Identifiable {
    var id: String { value }
    let name: String
    let value: String
    let icon: String
}

struct MeasurementExplanationView: View {
    let configureLater: () -> Void
    let skip: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.large) {
                Text("利用状況を加えると\n判断材料が育ちます")
                    .font(.appDisplay)
                TrustPoint(icon: "chart.xyaxis.line", title: "集計値だけ", detail: "使った日と時間帯の目安だけを見直しに使います。詳しい操作履歴は取得しません。")
                TrustPoint(icon: "hand.raised", title: "許可は任意", detail: "許可しなくても、料金、更新日、重複、プラン情報による見直しを利用できます。")
                Button("ホームへ進み、契約から設定", action: configureLater)
                    .appProminentButtonStyle()
                    .controlSize(.large)
                Button("今回は使わない", action: skip)
                    .buttonStyle(.bordered)
            }
            .padding(AppSpacing.large)
        }
    }
}

struct FirstReviewView: View {
    @ObservedObject var store: ProductStore
    let next: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.large) {
                Text("最初の見直し")
                    .font(.appDisplay)
                if let recommendation = store.recommendations.first,
                   let subscription = store.subscription(id: recommendation.subscriptionId) {
                    ReviewSummaryCard(subscription: subscription, recommendation: recommendation)
                } else {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: AppSpacing.small) {
                            Text("判断材料を準備しています").font(.appHeadline)
                            Text("料金と更新日だけでも見直しを始められます。利用状況を設定した場合、結果はデータが育ってから追加されます。")
                                .foregroundStyle(AppColor.secondaryText)
                        }
                    }
                }
                Button("利用状況の説明へ", action: next)
                    .appProminentButtonStyle()
                    .controlSize(.large)
            }
            .padding(AppSpacing.large)
        }
        .task {
            await store.loadAll()
            if store.recommendations.isEmpty { await store.recompute() }
            await store.recordGuidanceEvent(.reviewViewed)
        }
    }
}
