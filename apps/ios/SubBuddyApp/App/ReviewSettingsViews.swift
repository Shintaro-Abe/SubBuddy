import AuthenticationServices
import FamilyControls
import SwiftUI
import UIKit

private enum ReviewFilter: String, CaseIterable, Identifiable {
    case all = "すべて"
    case now = "今確認"
    case renewal = "更新前"
    case missing = "情報不足"
    var id: String { rawValue }
}

struct ReviewListView: View {
    @ObservedObject var store: ProductStore
    @State private var filter: ReviewFilter = .all

    private var filtered: [Recommendation] {
        store.recommendations.filter { item in
            switch filter {
            case .all:
                return true
            case .now:
                return item.reviewPriority == .now
            case .renewal:
                return item.reviewPriority == .beforeRenewal
            case .missing:
                return item.reviewPriority == .missingInformation
            }
        }
    }

    var body: some View {
        Group {
            if store.isLoading && store.recommendations.isEmpty {
                ProgressView("見直し材料を読み込んでいます")
            } else if store.subscriptions.isEmpty {
                EmptyStateView(
                    title: "契約を登録すると始まります",
                    message: "見直したい契約を1件登録してください。",
                    systemImage: "checklist"
                )
            } else {
                List {
                    Section {
                        FirstVisitExplanation(
                            key: "review",
                            text: "解約を決める画面ではありません。分かっている事実、足りない情報、選択肢を確認する場所です。"
                        )
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }

                    Picker("表示", selection: $filter) {
                        ForEach(ReviewFilter.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)

                    if filtered.isEmpty {
                        Section {
                            VStack(alignment: .leading, spacing: AppSpacing.small) {
                                Text(store.recommendations.isEmpty ? "見直し結果はまだありません" : "条件に合う結果はありません")
                                    .font(.appHeadline)
                                Text("料金や更新日は契約画面でいつでも確認できます。結果がない場合は再計算をお試しください。")
                                    .font(.appSubheadline)
                                    .foregroundStyle(AppColor.secondaryText)
                                Button("見直し材料を再計算") {
                                    Task { await store.recompute() }
                                }
                                .disabled(store.isSaving)
                            }
                            .padding(.vertical, AppSpacing.small)
                        }
                    }

                    if !store.blockedRecommendations.isEmpty {
                        Section("再計算が必要") {
                            ForEach(store.blockedRecommendations, id: \.subscriptionId) { blocked in
                                VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                                    if let subscription = store.subscription(id: blocked.subscriptionId) {
                                        Text(subscription.name)
                                            .font(.appHeadline)
                                    }
                                    Text(blocked.message)
                                        .font(.appSubheadline)
                                        .foregroundStyle(AppColor.secondaryText)
                                    Button("見直し材料を再計算") {
                                        Task { await store.recompute() }
                                    }
                                    .disabled(store.isSaving)
                                }
                                .padding(.vertical, AppSpacing.xSmall)
                            }
                        }
                    }

                    ForEach(filtered) { recommendation in
                        if let subscription = store.subscription(id: recommendation.subscriptionId) {
                            NavigationLink {
                                ReviewDetailView(
                                    subscription: subscription,
                                    recommendation: recommendation,
                                    store: store
                                )
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    StatusPill(
                                        text: recommendation.reviewPriority.label,
                                        color: color(for: recommendation.reviewPriority)
                                    )
                                    Text(subscription.name).font(.appHeadline)
                                    Text(recommendation.reason)
                                        .font(.appSubheadline)
                                        .foregroundStyle(AppColor.secondaryText)
                                        .lineLimit(2)
                                }
                                .padding(.vertical, AppSpacing.xSmall)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .appListBackground()
                .refreshable { await store.loadAll() }
            }
        }
        .appPageBackground()
        .navigationTitle("見直し")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("再計算", systemImage: "arrow.clockwise") {
                    Task { await store.recompute() }
                }
                .disabled(store.isSaving || store.subscriptions.isEmpty)
            }
        }
    }

    private func color(for priority: ReviewPriority) -> Color {
        switch priority {
        case .now: return AppColor.caution
        case .beforeRenewal: return AppColor.caution
        case .missingInformation: return AppColor.secondaryText
        case .lowUrgency: return AppColor.accent
        }
    }
}

struct ReviewSummaryCard: View {
    let subscription: Subscription
    let recommendation: Recommendation

    var body: some View {
        ReviewCard {
            VStack(alignment: .leading, spacing: AppSpacing.small) {
                Text(recommendation.reviewPriority.label)
                    .font(.appCaptionBold)
                    .foregroundStyle(.white.opacity(0.8))
                Text(subscription.name).font(.appTitle2)
                Text(recommendation.reason).font(.appSubheadline).lineLimit(3)
                Label("根拠の詳細を見る", systemImage: "arrow.right")
                    .font(.appHeadline)
                    .padding(.top, AppSpacing.xSmall)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint("見直しの詳しい根拠を開きます")
    }
}

struct ReviewDetailView: View {
    let subscription: Subscription
    let recommendation: Recommendation
    var store: ProductStore? = nil
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.large) {
                StatusPill(
                    text: recommendation.reviewPriority.label,
                    color: color(for: recommendation.reviewPriority)
                )
                Text(subscription.name)
                    .font(.appDisplay)
                    .accessibilityAddTraits(.isHeader)

                SurfaceCard {
                    VStack(alignment: .leading, spacing: AppSpacing.medium) {
                        Text("分かっていること").font(.appTitle)
                        FactRow(label: "年額目安", value: AppFormatters.yen(recommendation.yearlyAmount))
                        FactRow(label: "最近30日の利用日", value: "\(recommendation.usageDays30d)日")
                        if recommendation.usageMinutes30d > 0 {
                            FactRow(label: "利用時間の目安", value: "\(recommendation.usageMinutes30d)分以上")
                        }
                        if let days = recommendation.daysUntilRenewal {
                            FactRow(label: "更新まで", value: "あと\(days)日")
                        }
                        if let cost = recommendation.costPerUsageDay {
                            FactRow(label: "1利用日あたり", value: AppFormatters.yen(Int(cost.rounded())))
                        }
                        Text("計算 \(AppFormatters.date(recommendation.generatedAt)) 時点")
                            .font(.appCaption)
                            .foregroundStyle(AppColor.secondaryText)
                    }
                }

                if let patterns = recommendation.matchedPatterns,
                   patterns.contains(where: { $0.label != nil || $0.detail != nil }) {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: AppSpacing.small) {
                            Text("確認の根拠").font(.appTitle)
                            ForEach(patterns) { pattern in
                                if let label = pattern.label ?? pattern.detail {
                                    VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                                        Label(label, systemImage: "circle.fill")
                                            .labelStyle(ReasonLabelStyle())
                                        if let detail = pattern.detail, detail != label {
                                            Text(detail)
                                                .font(.appSubheadline)
                                                .foregroundStyle(AppColor.secondaryText)
                                                .padding(.leading, 15)
                                        }
                                        if let caveat = pattern.caveat {
                                            Text(caveat)
                                                .font(.appFootnote)
                                                .foregroundStyle(AppColor.caution)
                                                .padding(.leading, 15)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: AppSpacing.small) {
                        Text("まだ分からないこと").font(.appTitle)
                        if recommendation.reviewUnknowns.isEmpty {
                            Text("利用頻度だけでは、その契約が必要かどうかを判断できません。仕事、家族利用、特典などもご自身で確認してください。")
                        } else {
                            ForEach(recommendation.reviewUnknowns) { unknown in
                                Text(unknown.message)
                            }
                        }
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: AppSpacing.medium) {
                        Text("確認できる選択肢").font(.appTitle)
                        ForEach(recommendation.reviewOptions) { option in
                            VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                                Label(option.title, systemImage: "circle")
                                Text(option.detail)
                                    .font(.appSubheadline)
                                    .foregroundStyle(AppColor.secondaryText)
                                if let annualSavings = option.annualSavings {
                                    Text("年間差額の目安 \(AppFormatters.yen(annualSavings))")
                                        .font(.appHeadline)
                                }
                                if let calculation = option.calculation {
                                    Text("計算: \(calculation)")
                                        .font(.appFootnote)
                                        .foregroundStyle(AppColor.secondaryText)
                                }
                                if let verifiedAt = option.verifiedAt {
                                    Text("料金確認 \(AppFormatters.date(verifiedAt))")
                                        .font(.appFootnote)
                                        .foregroundStyle(AppColor.secondaryText)
                                }
                                if let url = safeURL(option.sourceUrl) {
                                    Button("確認に使った公式情報を見る") {
                                        openURL(url)
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }
                        }
                    }
                }

                if let url = safeURL(subscription.cancellationUrl) {
                    Button {
                        openURL(url)
                    } label: {
                        Label("登録した手続きページを見る", systemImage: "arrow.up.right.square")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                } else {
                    Text("公式の手続きページは登録されていません。サービス公式サイトから確認してください。")
                        .font(.appFootnote)
                        .foregroundStyle(AppColor.secondaryText)
                }
            }
            .padding(AppSpacing.medium)
        }
        .background(AppColor.background)
        .navigationTitle("見直し詳細")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store?.recordGuidanceEvent(.reviewViewed) }
    }

    private func safeURL(_ rawValue: String?) -> URL? {
        guard let rawValue, let url = URL(string: rawValue),
              ["https", "http"].contains(url.scheme?.lowercased() ?? "") else { return nil }
        return url
    }

    private func color(for priority: ReviewPriority) -> Color {
        switch priority {
        case .now, .beforeRenewal: return AppColor.caution
        case .missingInformation: return AppColor.secondaryText
        case .lowUrgency: return AppColor.accent
        }
    }
}

private struct FactRow: View {
    let label: String
    let value: String
    var body: some View {
        HStack {
            Text(label).foregroundStyle(AppColor.secondaryText)
            Spacer()
            Text(value).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }
}

private struct ReasonLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: AppSpacing.small) {
            configuration.icon.font(.system(size: 7)).foregroundStyle(AppColor.accent)
            configuration.title
        }
    }
}

struct SettingsView: View {
    @ObservedObject var authSession: AuthSession
    @ObservedObject var store: ProductStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section {
                NavigationLink {
                    GettingStartedView(store: store)
                } label: {
                    Label("使い方", systemImage: "list.number")
                }
                NavigationLink {
                    DataHandlingView()
                } label: {
                    Label("あなたのデータ", systemImage: "lock.shield")
                }
            } footer: {
                Text("何を保存し、何を送らないか確認できます。")
            }

            Section("計測と同期") {
                NavigationLink {
                    ScreenTimeSettingsView()
                } label: {
                    Label("Screen Timeと計測対象", systemImage: "hourglass")
                }
                NavigationLink {
                    SyncSettingsView()
                } label: {
                    Label("同期", systemImage: "arrow.triangle.2.circlepath")
                }
                NavigationLink {
                    NotificationSettingsView()
                } label: {
                    Label("通知", systemImage: "bell")
                }
            }

            Section("安全とサポート") {
                NavigationLink {
                    SessionSettingsView(store: store)
                } label: {
                    Label("端末とセッション", systemImage: "iphone.and.arrow.forward")
                }
                NavigationLink {
                    SupportView()
                } label: {
                    Label("ヘルプ・問い合わせ", systemImage: "questionmark.circle")
                }
                NavigationLink {
                    UnavailableFeatureView(
                        title: "データ出力",
                        message: "CSV/JSON出力は安全なサーバー処理の接続後に利用できます。現在のビルドでは未接続です。"
                    )
                } label: {
                    Label("データを書き出す", systemImage: "square.and.arrow.up")
                }
            }

            Section("アカウント") {
                Button("このiPhoneからサインアウト") {
                    Task {
                        await authSession.signOutCurrentSession()
                        dismiss()
                    }
                }
                .disabled(authSession.isWorking)

                NavigationLink {
                    AccountDeletionView(authSession: authSession)
                } label: {
                    Text("アカウントとデータを削除").foregroundStyle(.red)
                }
            }

            Section {
                Text("SubBuddy \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")")
                    .font(.appCaption)
                    .foregroundStyle(AppColor.secondaryText)
            }
        }
        .appListBackground()
        .navigationTitle("設定")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("閉じる") { dismiss() }
            }
        }
    }
}

private struct GettingStartedView: View {
    @ObservedObject var store: ProductStore

    var body: some View {
        List {
            Section {
                ForEach(Array(GuidanceStep.allCases.enumerated()), id: \.element) { index, step in
                    HStack(alignment: .top, spacing: AppSpacing.medium) {
                        Image(systemName: store.guidanceProgress.steps.isComplete(step) ? "checkmark.circle.fill" : "\(index + 1).circle")
                            .foregroundStyle(AppColor.accent)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                            Text(step.title).font(.appHeadline)
                            Text(step.detail)
                                .font(.appSubheadline)
                                .foregroundStyle(AppColor.secondaryText)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityValue(store.guidanceProgress.steps.isComplete(step) ? "完了" : "未完了")
                }
            } header: {
                Text("はじめ方 \(store.guidanceProgress.completedCount)/\(store.guidanceProgress.totalCount)")
            }

            Section("利用状況の計測") {
                Text("計測は任意です。使った日と時間帯の目安だけを見直しに使い、詳しい操作内容は送りません。設定しなくても料金や更新日から見直せます。")
                if !store.guidanceProgress.steps.measurement {
                    Button("今回は使わない") {
                        Task { await store.recordGuidanceEvent(.measurementSkipped) }
                    }
                }
            }
        }
        .appListBackground()
        .navigationTitle("使い方")
    }
}

private struct DataHandlingView: View {
    var body: some View {
        List {
            Section("クラウドへ保存") {
                Label("契約と支出の集計", systemImage: "checkmark.circle")
                Label("最新の見直し結果", systemImage: "checkmark.circle")
                Label("日ごとの利用集計", systemImage: "checkmark.circle")
            }
            Section("iPhone内だけ") {
                Label("計測対象として選んだアプリ", systemImage: "iphone")
            }
            Section("送信しない") {
                Label("詳しい操作履歴", systemImage: "xmark.circle")
                Label("画面の内容やスクリーンショット", systemImage: "xmark.circle")
                Label("Apple提供の氏名・メール", systemImage: "xmark.circle")
            }
        }
        .appListBackground()
        .navigationTitle("あなたのデータ")
    }
}

private struct ScreenTimeSettingsView: View {
    @State private var status = AuthorizationCenter.shared.authorizationStatus
    var body: some View {
        List {
            Section {
                StatusPill(
                    text: status == .approved ? "利用できます" : "利用していません",
                    color: status == .approved ? AppColor.accent : AppColor.caution
                )
                Text("計測対象は契約詳細から設定します。許可しなくても契約・支出・見直しを利用できます。")
                    .foregroundStyle(AppColor.secondaryText)
            }
        }
        .appListBackground()
        .navigationTitle("Screen Time")
    }
}

private struct SyncSettingsView: View {
    @StateObject private var session = MeasurementSession()
    @AppStorage(UsageSyncStatus.lastSuccessAtKey) private var lastSuccessAt = 0.0
    @AppStorage(UsageSyncStatus.lastAttemptAtKey) private var lastAttemptAt = 0.0
    @AppStorage(UsageSyncStatus.lastFailedKey) private var lastFailed = false

    var body: some View {
        List {
            Section {
                LabeledContent("自動同期", value: "オン")
                LabeledContent("最終同期確認", value: formattedLastSuccess)
                LabeledContent("端末内の未送信記録", value: "\(session.recordCount)件")
                Button(session.isSyncing ? "同期しています…" : "今すぐ同期") {
                    Task { await session.syncRecords() }
                }
                .disabled(session.isSyncing)
                Text(syncDescription)
                    .font(.appFootnote)
                    .foregroundStyle(lastFailed ? AppColor.caution : AppColor.secondaryText)
            }
        }
        .appListBackground()
        .navigationTitle("同期")
        .onAppear { session.refreshRecords() }
        .onChange(of: lastSuccessAt) { _, _ in session.refreshRecords() }
    }

    private var formattedLastSuccess: String {
        guard lastSuccessAt > 0 else { return "まだありません" }
        return Date(timeIntervalSince1970: lastSuccessAt).formatted(
            date: .abbreviated,
            time: .shortened
        )
    }

    private var syncDescription: String {
        if lastFailed, lastAttemptAt > 0 {
            return "前回は同期できませんでした。未送信記録を保持し、次回の起動・復帰時に自動で再試行します。必要な場合は今すぐ同期できます。"
        }
        if session.recordCount > 0 {
            return "起動・サインイン完了・アプリ復帰時に自動同期します。当日分は後の利用時間更新に備えて端末内に残る場合があります。"
        }
        return "利用集計は起動・サインイン完了・アプリ復帰時に自動同期します。今すぐ同期は確認・復旧用です。"
    }
}

private struct NotificationSettingsView: View {
    @AppStorage("renewal_notifications") private var renewalNotifications = false
    @AppStorage("sync_failure_notifications") private var syncNotifications = false
    var body: some View {
        Form {
            Toggle("更新日の事前通知", isOn: $renewalNotifications)
            Toggle("同期失敗の通知", isOn: $syncNotifications)
            Text("通知の許可要求と配信処理は未接続です。設定は端末内に保存し、接続完了まで通知済みとは表示しません。")
                .font(.appFootnote)
                .foregroundStyle(AppColor.secondaryText)
        }
        .disabled(true)
        .appListBackground()
        .navigationTitle("通知")
    }
}

private struct AccountDeletionView: View {
    @ObservedObject var authSession: AuthSession
    @State private var hasConfirmed = false
    @State private var deletionFailed = false

    var body: some View {
        Form {
            Section {
                Text("契約、利用集計、見直し結果、端末とセッションを削除します。この操作は元に戻せません。")
                    .foregroundStyle(.red)
                Toggle("削除内容を確認しました", isOn: $hasConfirmed)
            } header: {
                Text("完全退会")
            }

            if hasConfirmed {
                Section {
                    SignInWithAppleButton(.continue) { request in
                        authSession.prepareAccountDeletionRequest(request)
                    } onCompletion: { result in
                        Task {
                            switch result {
                            case .success(let authorization):
                                deletionFailed = !(await authSession.deleteAccount(with: authorization))
                            case .failure(let error):
                                authSession.handleAppleAuthorizationError(error)
                                deletionFailed = true
                            }
                        }
                    }
                    .signInWithAppleButtonStyle(.black)
                    .appAppleSignInButtonSize()
                    .disabled(authSession.isWorking)
                    Text("削除の直前にAppleで本人確認します。")
                        .font(.appFootnote)
                        .foregroundStyle(AppColor.secondaryText)
                }
            }

            if deletionFailed {
                Section {
                    Text(authSession.statusMessage)
                        .foregroundStyle(.red)
                }
            }
        }
        .appListBackground()
        .navigationTitle("アカウントを削除")
    }
}

private struct SessionSettingsView: View {
    @ObservedObject var store: ProductStore
    var body: some View {
        List {
            if store.sessions.isEmpty {
                Text("有効なセッションを読み込んでいます。")
                    .foregroundStyle(AppColor.secondaryText)
            }
            ForEach(store.sessions) { session in
                VStack(alignment: .leading, spacing: AppSpacing.small) {
                    HStack {
                        Text(session.clientType == "ios" ? "iPhone" : "Webブラウザ")
                            .font(.appHeadline)
                        if session.current == true { StatusPill(text: "現在") }
                    }
                    Text("最終利用 \(AppFormatters.date(session.lastUsedAt))")
                        .font(.appCaption)
                        .foregroundStyle(AppColor.secondaryText)
                    if session.current != true {
                        Button("このセッションを解除", role: .destructive) {
                            Task { await store.revokeSession(id: session.id) }
                        }
                    }
                }
                .padding(.vertical, AppSpacing.xSmall)
            }
        }
        .appListBackground()
        .navigationTitle("端末とセッション")
        .task { await store.loadSessions() }
    }
}

private struct SupportView: View {
    var body: some View {
        List {
            Section {
                Text("問い合わせ機能は、契約名・金額・利用量を自動添付しません。診断情報の内容を確認してから任意で送る設計です。")
            }
            Section {
                LabeledContent("アプリ", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "不明")
                LabeledContent("iOS", value: UIDevice.current.systemVersion)
                LabeledContent("権限", value: AuthorizationCenter.shared.authorizationStatus == .approved ? "許可" : "未許可")
            } header: {
                Text("送信前に確認できる診断情報")
            } footer: {
                Text("契約、支出、利用量、認証情報、端末内選択情報は含みません。送信処理は別タスクで接続します。")
            }
        }
        .appListBackground()
        .navigationTitle("ヘルプ・問い合わせ")
    }
}

private struct UnavailableFeatureView: View {
    let title: String
    let message: String
    var body: some View {
        EmptyStateView(title: "現在は利用できません", message: message, systemImage: "lock.shield")
            .appPageBackground()
            .navigationTitle(title)
    }
}
