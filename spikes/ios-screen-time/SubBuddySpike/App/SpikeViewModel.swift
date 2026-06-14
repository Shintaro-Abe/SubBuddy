import SwiftUI
import Combine
import FamilyControls

/// Spike の最小 UI 用 ViewModel。
/// 認可 → 対象選択 → 監視登録 → 状態表示 → 送信 を一本通しする。
@MainActor
final class SpikeViewModel: ObservableObject {

    // ── 状態 ──
    @Published var isAuthorized = false
    @Published var selection = FamilyActivitySelection()
    @Published var isMonitoring = false
    @Published var records: [UsageRecord] = []
    @Published var statusMessage = "未開始"
    @Published var subscriptionId = ""

    private let scheduler = MonitorScheduler()
    private let store = SharedStore()
    private let mappingStore = MappingStore()
    private let syncService = UsageSyncService()

    // ── 段階2-1: 認可 ──
    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            isAuthorized = true
            statusMessage = "認可成功"
        } catch {
            statusMessage = "認可失敗: \(error.localizedDescription)"
        }
    }

    // ── 段階2-4: 監視登録 ──
    func startMonitoring() {
        guard !subscriptionId.isEmpty else {
            statusMessage = "サブスク ID を入力してください"
            return
        }
        guard !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty else {
            statusMessage = "対象アプリを選択してください"
            return
        }

        let activityName = mappingStore.activityName(for: subscriptionId)

        // 対応表を保存
        if let selData = try? JSONEncoder().encode(selection) {
            mappingStore.save(SubscriptionMapping(
                subscriptionId: subscriptionId,
                activityName: activityName,
                selection: selData
            ))
        }

        do {
            try scheduler.startMonitoring(activityName: activityName, selection: selection)
            isMonitoring = true
            statusMessage = "監視中: \(activityName)"
        } catch {
            statusMessage = "監視登録失敗: \(error.localizedDescription)"
        }
    }

    func stopMonitoring() {
        scheduler.stopAll()
        isMonitoring = false
        statusMessage = "監視停止"
    }

    // ── 段階1: App Group 読取確認 ──
    func refreshRecords() {
        records = store.readAll()
        statusMessage = "レコード数: \(records.count)"
    }

    // ── 段階6: 送信 ──
    func sync() async {
        do {
            let count = try await syncService.syncAll()
            statusMessage = "送信完了: \(count) 件"
            refreshRecords()
        } catch {
            statusMessage = "送信失敗: \(error.localizedDescription)"
        }
    }

    // ── 状態確認 ──
    var activeMonitors: [String] {
        scheduler.activeActivities
    }
}
