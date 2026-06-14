import SwiftUI
import FamilyControls

struct ContentView: View {
    @StateObject private var vm = SpikeViewModel()
    @State private var showPicker = false

    var body: some View {
        NavigationStack {
            List {
                // ── 認可 ──
                Section("1. 認可") {
                    Button("Screen Time の許可を求める") {
                        Task { await vm.requestAuthorization() }
                    }
                    .disabled(vm.isAuthorized)

                    Text(vm.isAuthorized ? "認可済み" : "未認可")
                        .foregroundStyle(vm.isAuthorized ? .green : .secondary)
                }

                // ── 対象選択 ──
                Section("2. 対象アプリ選択") {
                    Button("アプリを選ぶ") { showPicker = true }
                        .disabled(!vm.isAuthorized)
                        .familyActivityPicker(
                            isPresented: $showPicker,
                            selection: $vm.selection
                        )

                    Text("選択中: \(vm.selection.applicationTokens.count) アプリ")
                }

                // ── サブスク ID ──
                Section("3. サブスク ID（Mac 側の ID）") {
                    TextField("例: clx1abc2def3", text: $vm.subscriptionId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                // ── 監視 ──
                Section("4. 監視") {
                    if vm.isMonitoring {
                        Button("監視を停止", role: .destructive) { vm.stopMonitoring() }
                    } else {
                        Button("監視を開始") { vm.startMonitoring() }
                            .disabled(vm.subscriptionId.isEmpty || (vm.selection.applicationTokens.isEmpty && vm.selection.categoryTokens.isEmpty))
                    }

                    if !vm.activeMonitors.isEmpty {
                        ForEach(vm.activeMonitors, id: \.self) { name in
                            Label(name, systemImage: "eye")
                                .font(.caption)
                        }
                    }
                }

                // ── レコード確認 ──
                Section("5. App Group レコード") {
                    Button("読み取り更新") { vm.refreshRecords() }

                    ForEach(vm.records, id: \.sequence) { record in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(record.date) — \(record.bucket.wireValue)")
                                .font(.body.monospaced())
                            Text("activity: \(record.activityId) seq: \(record.sequence)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // ── 送信 ──
                Section("6. Mac へ送信") {
                    Button("未送信データを送信") {
                        Task { await vm.sync() }
                    }
                }

                // ── ステータス ──
                Section("ステータス") {
                    Text(vm.statusMessage)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
            .navigationTitle("SubBuddy Spike")
        }
    }
}
