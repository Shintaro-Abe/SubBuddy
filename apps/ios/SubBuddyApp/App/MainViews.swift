import SwiftUI

enum MainTab: Hashable {
    case home
    case subscriptions
    case review
}

struct MainTabView: View {
    @ObservedObject var authSession: AuthSession
    @ObservedObject var store: ProductStore
    @State private var selection: MainTab = .home

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                HomeView(authSession: authSession, store: store)
            }
            .tabItem { Label("ホーム", systemImage: "house") }
            .tag(MainTab.home)

            NavigationStack {
                SubscriptionListView(store: store)
            }
            .tabItem { Label("契約", systemImage: "list.bullet.rectangle") }
            .tag(MainTab.subscriptions)

            NavigationStack {
                ReviewListView(store: store)
            }
            .tabItem { Label("見直し", systemImage: "checklist") }
            .tag(MainTab.review)
        }
        .task {
            if store.subscriptions.isEmpty || store.requiresReauthentication { await store.loadAll() }
        }
        .onChange(of: store.requiresReauthentication) { _, required in
            if required { authSession.requireReauthentication() }
        }
    }
}

struct HomeView: View {
    @ObservedObject var authSession: AuthSession
    @ObservedObject var store: ProductStore
    @State private var showsSettings = false

    private var nextRecommendation: (Subscription, Recommendation)? {
        let ordered = store.recommendations.sorted {
            priority($0.decision) > priority($1.decision)
        }
        for recommendation in ordered {
            if let subscription = store.subscription(id: recommendation.subscriptionId) {
                return (subscription, recommendation)
            }
        }
        return nil
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: AppSpacing.large) {
                if let error = store.errorMessage {
                    InlineErrorView(message: error) {
                        Task { await store.loadAll() }
                    }
                }

                if let nextRecommendation {
                    NavigationLink {
                        ReviewDetailView(
                            subscription: nextRecommendation.0,
                            recommendation: nextRecommendation.1
                        )
                    } label: {
                        ReviewCard {
                            VStack(alignment: .leading, spacing: AppSpacing.small) {
                                Text("次に確認すること")
                                    .font(.appCaption)
                                    .foregroundStyle(.white.opacity(0.78))
                                Text(nextRecommendation.0.name)
                                    .font(.appTitle2)
                                Text(nextRecommendation.1.reason)
                                    .font(.appSubheadline)
                                    .lineLimit(3)
                                Label("内容を確認", systemImage: "arrow.right")
                                    .font(.appHeadline)
                                    .padding(.top, AppSpacing.small)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("見直しの詳しい内容を開きます")
                } else if !store.isLoading {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: AppSpacing.small) {
                            Text("次に確認すること").font(.appCaption).foregroundStyle(AppColor.secondaryText)
                            Text(store.subscriptions.isEmpty ? "最初の契約を登録しましょう" : "見直し材料を準備しています")
                                .font(.appTitle)
                            Text(store.subscriptions.isEmpty
                                 ? "1件登録すると、年間支出の目安を確認できます。"
                                 : "料金や更新日を確認しながら、結果が育つのを待てます。")
                                .foregroundStyle(AppColor.secondaryText)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                    Text("登録中の年間支出（目安）")
                        .font(.appCaption)
                        .foregroundStyle(AppColor.secondaryText)
                    Text(AppFormatters.yen(store.dashboard?.yearlyTotal ?? 0))
                        .font(.appMoney)
                        .minimumScaleFactor(0.55)
                        .lineLimit(1)
                    HStack {
                        Text("\(store.dashboard?.activeCount ?? 0)件")
                        if let lastUpdatedAt = store.lastUpdatedAt {
                            Text("・\(lastUpdatedAt.formatted(date: .omitted, time: .shortened))更新")
                        }
                    }
                    .font(.appCaption)
                    .foregroundStyle(AppColor.secondaryText)
                }
                .accessibilityElement(children: .combine)

                VStack(spacing: 0) {
                    NavigationLink {
                        UpcomingRenewalView(items: store.upcomingRenewals)
                    } label: {
                        HomeRow(title: "更新が近い", detail: "\(store.upcomingRenewals.count)件", icon: "calendar")
                    }
                    Divider()
                    NavigationLink {
                        SpendingView(store: store)
                    } label: {
                        HomeRow(title: "支出の内訳", detail: nil, icon: "chart.bar.xaxis")
                    }
                    Divider()
                    NavigationLink {
                        SubscriptionListView(store: store)
                    } label: {
                        HomeRow(title: "棚卸しを続ける", detail: nil, icon: "square.and.pencil")
                    }
                }
                .buttonStyle(.plain)
                .background(AppColor.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .padding(AppSpacing.medium)
        }
        .background(AppColor.background)
        .navigationTitle("ホーム")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("設定", systemImage: "gearshape") { showsSettings = true }
                    .accessibilityHint("データ、同期、アカウントの設定を開きます")
            }
        }
        .refreshable { await store.loadAll() }
        .sheet(isPresented: $showsSettings) {
            NavigationStack {
                SettingsView(authSession: authSession, store: store)
            }
        }
    }

    private func priority(_ decision: RecommendationDecision?) -> Int {
        switch decision {
        case .strongCancelCandidate: return 5
        case .considerCancel: return 4
        case .considerDowngrade: return 3
        case .review: return 2
        case .keep: return 1
        case nil: return 0
        }
    }
}

private struct HomeRow: View {
    let title: String
    let detail: String?
    let icon: String

    var body: some View {
        HStack(spacing: AppSpacing.medium) {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundStyle(AppColor.accentOnSurface)
                .accessibilityHidden(true)
            Text(title)
                .foregroundStyle(.primary)
            Spacer()
            if let detail { Text(detail).foregroundStyle(AppColor.secondaryText) }
            Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(.tertiary)
        }
        .padding(AppSpacing.medium)
        .frame(minHeight: 52)
        .contentShape(Rectangle())
    }
}

struct UpcomingRenewalView: View {
    let items: [UpcomingRenewal]

    var body: some View {
        Group {
            if items.isEmpty {
                EmptyStateView(
                    title: "14日以内の更新はありません",
                    message: "更新日を登録すると、近づいた契約をここで確認できます。",
                    systemImage: "calendar.badge.checkmark"
                )
            } else {
                List(items) { item in
                    VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                        HStack {
                            Text(item.name).font(.appHeadline)
                            Spacer()
                            Text("あと\(item.daysUntilRenewal)日")
                                .font(.appCaptionBold)
                                .foregroundStyle(AppColor.caution)
                        }
                        Text("\(AppFormatters.yen(item.amount))・\(item.billingCycle.label)・\(AppFormatters.date(item.nextRenewalDate))")
                            .font(.appSubheadline)
                            .foregroundStyle(AppColor.secondaryText)
                    }
                    .padding(.vertical, AppSpacing.xSmall)
                }
                .listStyle(.plain)
                .appListBackground()
            }
        }
        .appPageBackground()
        .navigationTitle("更新が近い")
    }
}

struct SpendingView: View {
    @ObservedObject var store: ProductStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.large) {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: AppSpacing.small) {
                        Text("月額換算").font(.appCaption).foregroundStyle(AppColor.secondaryText)
                        Text(AppFormatters.yen(store.spending?.monthlyTotal ?? 0))
                            .font(.appMoney)
                            .minimumScaleFactor(0.6)
                        Text("年額見込み \(AppFormatters.yen(store.spending?.yearlyTotal ?? 0))")
                            .foregroundStyle(AppColor.secondaryText)
                    }
                }

                if let categories = store.spending?.byCategory, !categories.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.medium) {
                        Text("カテゴリ別").font(.appTitle)
                        ForEach(categories) { item in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(AppFormatters.category(item.category))
                                    Spacer()
                                    Text(AppFormatters.yen(item.monthly)).monospacedDigit()
                                }
                                ProgressView(value: item.share)
                                    .tint(AppColor.accent)
                                    .accessibilityLabel(AppFormatters.category(item.category))
                                    .accessibilityValue("全体の\(Int(item.share * 100))パーセント")
                            }
                        }
                    }
                }

                if let trend = store.spending?.monthlyTrend, !trend.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.medium) {
                        Text("月次推移").font(.appTitle)
                        let maxValue = max(trend.map(\.monthly).max() ?? 1, 1)
                        HStack(alignment: .bottom, spacing: AppSpacing.small) {
                            ForEach(trend) { item in
                                VStack(spacing: 6) {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(AppColor.accent.opacity(item.id == trend.last?.id ? 1 : 0.35))
                                        .frame(height: max(4, CGFloat(item.monthly) / CGFloat(maxValue) * 120))
                                    Text(String(item.month.suffix(2)))
                                        .font(.appCaption2)
                                        .foregroundStyle(AppColor.secondaryText)
                                }
                                .frame(maxWidth: .infinity)
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel("\(item.month)の月額換算")
                                .accessibilityValue(AppFormatters.yen(item.monthly))
                            }
                        }
                        .frame(height: 155, alignment: .bottom)
                    }
                }

                Text("現在『利用中』の契約を月額へ換算した目安です。金額未入力の契約は、API対応後に除外件数とともに表示します。")
                    .font(.appFootnote)
                    .foregroundStyle(AppColor.secondaryText)
            }
            .padding(AppSpacing.medium)
        }
        .background(AppColor.background)
        .navigationTitle("支出の内訳")
        .refreshable { await store.loadAll() }
    }
}
