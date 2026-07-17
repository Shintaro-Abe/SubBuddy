import FamilyControls
import SwiftUI

private enum SubscriptionFilter: String, CaseIterable, Identifiable {
    case all = "すべて"
    case renewal = "更新間近"
    case missing = "情報不足"
    var id: String { rawValue }
}

struct SubscriptionListView: View {
    @ObservedObject var store: ProductStore
    @State private var searchText = ""
    @State private var filter: SubscriptionFilter = .all
    @State private var showsAdd = false

    private var filtered: [Subscription] {
        store.subscriptions.filter { subscription in
            let matchesSearch = searchText.isEmpty
                || subscription.name.localizedCaseInsensitiveContains(searchText)
                || AppFormatters.category(subscription.category).localizedCaseInsensitiveContains(searchText)
            guard matchesSearch else { return false }
            switch filter {
            case .all:
                return true
            case .renewal:
                return store.upcomingRenewals.contains { $0.id == subscription.id }
            case .missing:
                return subscription.nextRenewalDate == nil || subscription.category.isEmpty
            }
        }
    }

    var body: some View {
        Group {
            if store.isLoading && store.subscriptions.isEmpty {
                ProgressView("契約を読み込んでいます")
            } else if store.subscriptions.isEmpty {
                EmptyStateView(
                    title: "契約はまだありません",
                    message: "最初の1件を登録すると、年間支出の目安が分かります。",
                    systemImage: "rectangle.stack.badge.plus",
                    actionTitle: "契約を追加",
                    action: { showsAdd = true }
                )
            } else {
                List {
                    Picker("表示", selection: $filter) {
                        ForEach(SubscriptionFilter.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)

                    if filtered.isEmpty {
                        Text("条件に合う契約はありません。")
                            .foregroundStyle(AppColor.secondaryText)
                    }

                    ForEach(filtered) { subscription in
                        NavigationLink {
                            SubscriptionDetailView(store: store, subscriptionID: subscription.id)
                        } label: {
                            SubscriptionRow(
                                subscription: subscription,
                                recommendation: store.recommendation(for: subscription.id)
                            )
                        }
                    }
                }
                .listStyle(.plain)
                .appListBackground()
                .searchable(text: $searchText, prompt: "サービスやカテゴリを検索")
                .refreshable { await store.loadAll() }
            }
        }
        .appPageBackground()
        .navigationTitle("契約")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("契約を追加", systemImage: "plus") { showsAdd = true }
            }
        }
        .sheet(isPresented: $showsAdd) {
            NavigationStack {
                SubscriptionFormView(store: store, mode: .create) {
                    showsAdd = false
                }
            }
        }
        .task {
            if store.subscriptions.isEmpty { await store.loadAll() }
        }
    }
}

private struct SubscriptionRow: View {
    let subscription: Subscription
    let recommendation: Recommendation?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(subscription.name).font(.appHeadline)
                Spacer()
                Text(AppFormatters.yen(subscription.amount)).monospacedDigit()
            }
            Text("\(AppFormatters.category(subscription.category))・\(subscription.billingCycle.label)・更新 \(AppFormatters.date(subscription.nextRenewalDate))")
                .font(.appSubheadline)
                .foregroundStyle(AppColor.secondaryText)
            if let recommendation {
                StatusPill(
                    text: recommendation.dataStatus == .observing
                        ? "観測中・あと\(recommendation.daysUntilReady)日"
                        : recommendation.decision?.label ?? "情報が不足しています",
                    color: recommendation.decision == .strongCancelCandidate ? .red : AppColor.caution
                )
            } else if subscription.nextRenewalDate == nil {
                StatusPill(text: "更新日を追加できます", color: AppColor.caution)
            }
        }
        .padding(.vertical, AppSpacing.xSmall)
        .accessibilityElement(children: .combine)
    }
}

struct SubscriptionDetailView: View {
    @ObservedObject var store: ProductStore
    let subscriptionID: String
    @State private var showsEdit = false
    @State private var showsDelete = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if let subscription = store.subscription(id: subscriptionID) {
                ScrollView {
                    VStack(alignment: .leading, spacing: AppSpacing.large) {
                        VStack(alignment: .leading, spacing: AppSpacing.xSmall) {
                            Text(AppFormatters.category(subscription.category))
                                .font(.appCaption)
                                .foregroundStyle(AppColor.secondaryText)
                            Text(subscription.name)
                                .font(.appDisplay)
                                .accessibilityAddTraits(.isHeader)
                        }

                        SurfaceCard {
                            VStack(spacing: AppSpacing.medium) {
                                DetailRow(label: "料金", value: "\(AppFormatters.yen(subscription.amount)) / \(subscription.billingCycle == .monthly ? "月" : "年")")
                                DetailRow(label: "年額目安", value: AppFormatters.yen(subscription.yearlyAmount))
                                DetailRow(label: "次回更新", value: AppFormatters.date(subscription.nextRenewalDate))
                                DetailRow(label: "状態", value: subscription.status.label)
                                DetailRow(label: "重要度", value: "5段階の\(subscription.importance)")
                            }
                        }

                        if subscription.usageType == "capacity" || subscription.planCapacityGb != nil {
                            CapacityCard(subscription: subscription)
                        }

                        if let recommendation = store.recommendation(for: subscription.id) {
                            NavigationLink {
                                ReviewDetailView(subscription: subscription, recommendation: recommendation)
                            } label: {
                                ReviewSummaryCard(subscription: subscription, recommendation: recommendation)
                            }
                            .buttonStyle(.plain)
                        }

                        NavigationLink {
                            MeasurementSetupView(subscription: subscription)
                        } label: {
                            SurfaceCard {
                                Label("利用状況を計測", systemImage: "hourglass")
                                    .font(.appHeadline)
                            }
                        }
                        .buttonStyle(.plain)

                        if let notes = subscription.notes, !notes.isEmpty {
                            SurfaceCard {
                                VStack(alignment: .leading, spacing: AppSpacing.small) {
                                    Text("メモ").font(.appHeadline)
                                    Text(notes)
                                }
                            }
                        }

                        Button("この契約を削除", role: .destructive) { showsDelete = true }
                            .frame(maxWidth: .infinity)
                            .padding(.top, AppSpacing.large)
                    }
                    .padding(AppSpacing.medium)
                }
                .background(AppColor.background)
                .navigationTitle("契約詳細")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("編集") { showsEdit = true }
                    }
                }
                .sheet(isPresented: $showsEdit) {
                    NavigationStack {
                        SubscriptionFormView(store: store, mode: .edit(subscription)) {
                            showsEdit = false
                        }
                    }
                }
                .confirmationDialog(
                    "この契約を削除しますか？",
                    isPresented: $showsDelete,
                    titleVisibility: .visible
                ) {
                    Button("契約を削除", role: .destructive) {
                        Task {
                            if await store.delete(id: subscription.id) { dismiss() }
                        }
                    }
                    Button("キャンセル", role: .cancel) {}
                } message: {
                    Text("契約に紐づく利用集計と見直し結果も削除されます。この操作は元に戻せません。")
                }
            } else if store.isLoading {
                ProgressView("契約を読み込んでいます")
            } else {
                EmptyStateView(
                    title: "契約が見つかりません",
                    message: "削除済みか、読み込みに失敗した可能性があります。",
                    systemImage: "questionmark.folder"
                )
            }
        }
    }
}

private struct DetailRow: View {
    let label: String
    let value: String
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).foregroundStyle(AppColor.secondaryText)
            Spacer()
            Text(value).multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct CapacityCard: View {
    let subscription: Subscription

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: AppSpacing.small) {
                Text("ストレージ容量").font(.appHeadline)
                if let used = subscription.usedCapacityGb, let plan = subscription.planCapacityGb, plan > 0 {
                    Text("\(used) GB / \(plan) GB")
                    ProgressView(value: min(Double(used) / Double(plan), 1))
                    Text("確認日 \(AppFormatters.date(subscription.capacityCheckedAt))")
                        .font(.appCaption)
                        .foregroundStyle(AppColor.secondaryText)
                } else {
                    Text("使用容量を入力すると、下位プランへ収まるか安全に確認できます。")
                        .foregroundStyle(AppColor.secondaryText)
                }
            }
        }
    }
}

enum SubscriptionFormMode {
    case create
    case edit(Subscription)
}

struct SubscriptionFormView: View {
    @ObservedObject var store: ProductStore
    let mode: SubscriptionFormMode
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var category: String
    @State private var amountText: String
    @State private var billingCycle: BillingCycle
    @State private var hasRenewalDate: Bool
    @State private var renewalDate: Date
    @State private var importance: Int
    @State private var status: SubscriptionStatus
    @State private var notes: String
    @State private var signupChannel: String
    @State private var cancellationURL: String
    @State private var matchedServiceID: String
    @State private var usageType: String
    @State private var initialValueAnswer: String
    @State private var planCapacityText: String
    @State private var usedCapacityText: String
    @State private var validationMessage: String?

    init(
        store: ProductStore,
        mode: SubscriptionFormMode,
        initialCategory: String? = nil,
        onSaved: @escaping () -> Void
    ) {
        self.store = store
        self.mode = mode
        self.onSaved = onSaved
        let subscription: Subscription?
        if case .edit(let item) = mode { subscription = item } else { subscription = nil }
        _name = State(initialValue: subscription?.name ?? "")
        _category = State(initialValue: subscription?.category ?? initialCategory ?? "other")
        _amountText = State(initialValue: subscription.map { String($0.amount) } ?? "")
        _billingCycle = State(initialValue: subscription?.billingCycle ?? .monthly)
        _hasRenewalDate = State(initialValue: subscription?.nextRenewalDate != nil)
        _renewalDate = State(initialValue: Self.date(from: subscription?.nextRenewalDate) ?? Date())
        _importance = State(initialValue: subscription?.importance ?? 3)
        _status = State(initialValue: subscription?.status ?? .active)
        _notes = State(initialValue: subscription?.notes ?? "")
        _signupChannel = State(initialValue: subscription?.signupChannel ?? "")
        _cancellationURL = State(initialValue: subscription?.cancellationUrl ?? "")
        _matchedServiceID = State(initialValue: subscription?.matchedServiceId ?? "")
        _usageType = State(initialValue: subscription?.usageType ?? "active_foreground")
        _initialValueAnswer = State(initialValue: subscription?.initialValueAnswer ?? "")
        _planCapacityText = State(initialValue: subscription?.planCapacityGb.map { String($0) } ?? "")
        _usedCapacityText = State(initialValue: subscription?.usedCapacityGb.map { String($0) } ?? "")
    }

    var body: some View {
        Form {
            if let validationMessage {
                Section {
                    Label(validationMessage, systemImage: "exclamationmark.circle")
                        .foregroundStyle(AppColor.caution)
                }
            }

            Section("サービス") {
                TextField("サービス名", text: $name)
                    .textContentType(.organizationName)
                Picker("カタログ候補", selection: $matchedServiceID) {
                    Text("手動入力").tag("")
                    ForEach(store.catalog.filter { $0.isSupported && !$0.isExcluded }) { item in
                        Text(item.canonicalName).tag(item.id)
                    }
                }
                .onChange(of: matchedServiceID) { _, id in
                    guard let item = store.catalog.first(where: { $0.id == id }) else { return }
                    name = item.canonicalName
                    category = item.category
                    cancellationURL = item.cancellationUrl ?? ""
                    usageType = item.usageType
                }
                TextField("カテゴリ", text: $category)
            }

            Section("料金") {
                TextField("日本円の請求額", text: $amountText)
                    .keyboardType(.numberPad)
                Picker("請求周期", selection: $billingCycle) {
                    ForEach(BillingCycle.allCases) { cycle in
                        Text(cycle.label).tag(cycle)
                    }
                }
                Text("現在のAPIでは金額が必須です。金額未入力のクラウド保存は別タスクの接続後に有効になります。")
                    .font(.appFootnote)
                    .foregroundStyle(AppColor.secondaryText)
            }

            Section("更新") {
                Toggle("更新日を登録", isOn: $hasRenewalDate)
                if hasRenewalDate {
                    DatePicker("次回更新日", selection: $renewalDate, displayedComponents: .date)
                }
                Picker("契約状態", selection: $status) {
                    ForEach(SubscriptionStatus.allCases) { item in
                        Text(item.label).tag(item)
                    }
                }
            }

            Section("判断材料") {
                Stepper("重要度 \(importance) / 5", value: $importance, in: 1...5)
                Picker("今の大切さ", selection: $initialValueAnswer) {
                    Text("未回答").tag("")
                    Text("とても大切").tag("very_important")
                    Text("ある程度大切").tag("somewhat")
                    Text("あまり大切ではない").tag("not_much")
                }
                TextField("契約経路（任意）", text: $signupChannel)
                TextField("公式の手続きURL（任意）", text: $cancellationURL)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                TextField("メモ（任意）", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
            }

            if usageType == "capacity" {
                Section("ストレージ容量") {
                    TextField("契約容量 GB", text: $planCapacityText).keyboardType(.numberPad)
                    TextField("使用容量 GB", text: $usedCapacityText).keyboardType(.numberPad)
                }
            }

            Section {
                Button(store.isSaving ? "保存しています…" : "保存") {
                    Task { await save() }
                }
                .disabled(store.isSaving)
            }
        }
        .appListBackground()
        .navigationTitle(isEditing ? "契約を編集" : "契約を追加")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("キャンセル") { dismiss() }
            }
        }
        .task {
            if store.catalog.isEmpty { await store.loadAll() }
        }
    }

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private func save() async {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCategory = category.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            validationMessage = "サービス名を入力してください。"
            return
        }
        guard !trimmedCategory.isEmpty else {
            validationMessage = "カテゴリを入力してください。"
            return
        }
        guard let amount = Int(amountText), amount >= 0 else {
            validationMessage = "日本円の請求額を0以上の整数で入力してください。"
            return
        }
        if !cancellationURL.isEmpty {
            guard let url = URL(string: cancellationURL),
                  ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                  url.host != nil else {
                validationMessage = "公式URLはhttps://またはhttp://で入力してください。"
                return
            }
        }

        let input = SubscriptionInput(
            name: trimmedName,
            category: trimmedCategory,
            amount: amount,
            currency: "JPY",
            billingCycle: billingCycle,
            nextRenewalDate: hasRenewalDate ? AppConstants.localDateString(from: renewalDate) : nil,
            importance: importance,
            cancellationUrl: cancellationURL.nilIfEmpty,
            notes: notes.nilIfEmpty,
            signupChannel: signupChannel.nilIfEmpty,
            status: status,
            matchedServiceId: matchedServiceID.nilIfEmpty,
            usageType: usageType,
            initialValueAnswer: initialValueAnswer.nilIfEmpty,
            planCapacityGb: Int(planCapacityText),
            usedCapacityGb: Int(usedCapacityText),
            capacityCheckedAt: usedCapacityText.isEmpty ? nil : AppConstants.localDateString()
        )
        let id: String?
        if case .edit(let subscription) = mode { id = subscription.id } else { id = nil }
        if await store.save(input: input, id: id) { onSaved() }
        else { validationMessage = store.errorMessage }
    }

    private static func date(from iso: String?) -> Date? {
        guard let iso else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(iso.prefix(10)))
    }
}

struct MeasurementSetupView: View {
    let subscription: Subscription
    @StateObject private var session = MeasurementSession()
    @State private var authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    @State private var showsPicker = false

    var body: some View {
        Form {
            Section {
                Text("選んだアプリの情報はこのiPhone内だけに保存します。クラウドへ送るのは日ごとの利用集計だけです。")
                StatusPill(text: authorizationLabel, color: authorizationStatus == .approved ? AppColor.accent : AppColor.caution)
            } header: {
                Text("データの扱い")
            }

            if authorizationStatus != .approved {
                Section {
                    Button("Screen Timeの利用を許可") {
                        Task { await requestAuthorization() }
                    }
                    Text("許可しなくても、料金や更新日による見直しは利用できます。")
                        .font(.appFootnote)
                        .foregroundStyle(AppColor.secondaryText)
                }
            } else {
                Section("計測対象") {
                    Button("アプリを選ぶ") { showsPicker = true }
                        .familyActivityPicker(isPresented: $showsPicker, selection: $session.selection)
                    Text("選択中のアプリ \(session.selection.applicationTokens.count)件")
                        .foregroundStyle(AppColor.secondaryText)
                }
                Section {
                    if session.isMonitoring {
                        Button("計測を停止", role: .destructive) { session.stopMonitoring() }
                    } else {
                        Button("この契約の計測を始める") { session.startMonitoring() }
                            .disabled(session.selection.applicationTokens.isEmpty && session.selection.categoryTokens.isEmpty)
                    }
                    Text(localizedStatus)
                        .font(.appFootnote)
                        .foregroundStyle(AppColor.secondaryText)
                }
            }
        }
        .appListBackground()
        .navigationTitle("利用状況を計測")
        .onAppear {
            session.subscriptionId = subscription.id
            authorizationStatus = AuthorizationCenter.shared.authorizationStatus
        }
    }

    private var authorizationLabel: String {
        switch authorizationStatus {
        case .approved: "Screen Timeは利用できます"
        case .denied: "Screen Timeは許可されていません"
        case .notDetermined: "Screen Timeはまだ設定されていません"
        default: "Screen Timeの状態を確認できません"
        }
    }

    private var localizedStatus: String {
        if session.isMonitoring { return "計測中です。結果が育つまで日数が必要です。" }
        return session.statusMessage
    }

    private func requestAuthorization() async {
        do { try await AuthorizationCenter.shared.requestAuthorization(for: .individual) }
        catch { }
        authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
