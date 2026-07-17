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
                return item.decision == .considerCancel || item.decision == .strongCancelCandidate
                    || item.decision == .considerDowngrade
            case .renewal:
                return (item.daysUntilRenewal ?? Int.max) <= 30
            case .missing:
                return item.dataStatus == .observing || item.decision == nil
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
                        Text("分かっている事実と分からない点を示します。続けるか見直すかは、ご自身で判断できます。")
                            .font(.appSubheadline)
                            .foregroundStyle(AppColor.secondaryText)
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

                    ForEach(filtered) { recommendation in
                        if let subscription = store.subscription(id: recommendation.subscriptionId) {
                            NavigationLink {
                                ReviewDetailView(subscription: subscription, recommendation: recommendation)
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    StatusPill(
                                        text: recommendation.dataStatus == .observing
                                            ? "観測中"
                                            : recommendation.decision?.label ?? "情報が不足しています",
                                        color: color(for: recommendation.decision)
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

    private func color(for decision: RecommendationDecision?) -> Color {
        switch decision {
        case .strongCancelCandidate: return .red
        case .considerCancel, .considerDowngrade: return AppColor.caution
        default: return AppColor.accent
        }
    }
}

struct ReviewSummaryCard: View {
    let subscription: Subscription
    let recommendation: Recommendation

    var body: some View {
        ReviewCard {
            VStack(alignment: .leading, spacing: AppSpacing.small) {
                Text(recommendation.dataStatus == .observing
                     ? "観測中・あと\(recommendation.daysUntilReady)日"
                     : recommendation.decision?.label ?? "情報が不足しています")
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
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.large) {
                StatusPill(
                    text: recommendation.dataStatus == .observing
                        ? "観測中"
                        : recommendation.decision?.label ?? "情報不足",
                    color: recommendation.decision == .strongCancelCandidate ? .red : AppColor.caution
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
                        if recommendation.dataStatus == .observing {
                            Text("利用状況は観測中です。確定まであと\(recommendation.daysUntilReady)日かかります。")
                        } else if recommendation.usageDays30d == 0 {
                            Text("別の端末やブラウザで使っている場合は記録されません。利用記録がないことだけで解約を判断できません。")
                        } else {
                            Text("利用頻度だけでは、その契約が必要かどうかを判断できません。仕事、家族利用、特典などもご自身で確認してください。")
                        }
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: AppSpacing.medium) {
                        Text("確認できる選択肢").font(.appTitle)
                        Label("このまま継続する", systemImage: "circle")
                        Label("料金やプランを確認する", systemImage: "circle")
                        Label("使い方や重複を確認する", systemImage: "circle")
                        Label("公式ページで解約条件を確認する", systemImage: "circle")
                        Text("表示される差額や節約額は、現在登録されている料金を基にした目安です。")
                            .font(.appFootnote)
                            .foregroundStyle(AppColor.secondaryText)
                    }
                }

                if let url = safeURL(subscription.cancellationUrl) {
                    Button {
                        openURL(url)
                    } label: {
                        Label("公式の手続きページを見る", systemImage: "arrow.up.right.square")
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
    }

    private func safeURL(_ rawValue: String?) -> URL? {
        guard let rawValue, let url = URL(string: rawValue),
              ["https", "http"].contains(url.scheme?.lowercased() ?? "") else { return nil }
        return url
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
    var body: some View {
        List {
            Section {
                LabeledContent("端末内の未送信記録", value: "\(session.recordCount)件")
                Button(session.isSyncing ? "同期しています…" : "今すぐ同期") {
                    Task { await session.syncRecords() }
                }
                .disabled(session.isSyncing)
                Text(session.recordCount == 0 ? "通常は自動で同期します。" : session.statusMessage)
                    .font(.appFootnote)
                    .foregroundStyle(AppColor.secondaryText)
            }
        }
        .appListBackground()
        .navigationTitle("同期")
        .onAppear { session.refreshRecords() }
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
                    .frame(minHeight: 52)
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
