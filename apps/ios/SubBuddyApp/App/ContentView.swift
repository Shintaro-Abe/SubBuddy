import AuthenticationServices
import FamilyControls
import SwiftUI

struct ContentView: View {
    @State private var authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    @StateObject private var authSession = AuthSession()
    @StateObject private var measurementSession = MeasurementSession()
    @State private var isPickerPresented = false
    @AppStorage("api_base_url") private var apiBaseURLInput = ""

    var body: some View {
        NavigationStack {
            List {
                Section("API") {
                    TextField("https://example.onrender.com", text: $apiBaseURLInput)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)

                    Text(apiBaseURLText)
                        .foregroundStyle(AppConstants.apiBaseURL == nil ? .red : .secondary)
                }

                Section("Account") {
                    SignInWithAppleButton(.signIn) { _ in
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
                    .frame(height: 44)
                    .disabled(authSession.isWorking || AppConstants.apiBaseURL == nil)

                    Text(authSession.statusMessage)
                        .foregroundStyle(authSession.isSignedIn ? .green : .secondary)

                    if let deviceId = authSession.deviceId {
                        Text("Device: \(deviceId)")
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Screen Time") {
                    Text(statusText)
                        .foregroundStyle(statusColor)

                    Button("Request Authorization") {
                        Task { await requestAuthorization() }
                    }
                    .disabled(authorizationStatus == .approved)
                }

                Section("Measurement") {
                    TextField("Subscription ID", text: $measurementSession.subscriptionId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    Button("Select Measured App") {
                        isPickerPresented = true
                    }
                    .disabled(authorizationStatus != .approved)
                    .familyActivityPicker(
                        isPresented: $isPickerPresented,
                        selection: $measurementSession.selection
                    )

                    Text("Selected apps: \(measurementSession.selection.applicationTokens.count)")
                        .foregroundStyle(.secondary)

                    if measurementSession.isMonitoring {
                        Button("Stop Monitoring", role: .destructive) {
                            measurementSession.stopMonitoring()
                        }
                    } else {
                        Button("Start Monitoring") {
                            measurementSession.startMonitoring()
                        }
                        .disabled(authorizationStatus != .approved)
                    }

                    Text(measurementSession.statusMessage)
                        .foregroundStyle(.secondary)
                }

                Section("Sync") {
                    Button("Refresh Local Records") {
                        measurementSession.refreshRecords()
                    }

                    Text("Local records: \(measurementSession.recordCount)")
                        .foregroundStyle(.secondary)

                    Button("Sync Records") {
                        Task { await measurementSession.syncRecords() }
                    }
                    .disabled(!authSession.isSignedIn || measurementSession.isSyncing)
                }

                Section("Build") {
                    Text("Host app and monitor extension are configured.")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("SubBuddy")
        }
    }

    private var apiBaseURLText: String {
        AppConstants.apiBaseURL?.absoluteString ?? "Not configured"
    }

    private var statusText: String {
        switch authorizationStatus {
        case .approved:
            return "Authorized"
        case .denied:
            return "Denied"
        case .notDetermined:
            return "Not Determined"
        default:
            return "Unknown"
        }
    }

    private var statusColor: Color {
        authorizationStatus == .approved ? .green : .secondary
    }

    private func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            authorizationStatus = AuthorizationCenter.shared.authorizationStatus
        } catch {
            authorizationStatus = AuthorizationCenter.shared.authorizationStatus
        }
    }
}
