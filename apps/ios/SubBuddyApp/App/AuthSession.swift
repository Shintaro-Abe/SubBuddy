import AuthenticationServices
import Combine
import CryptoKit
import Foundation
import Security

@MainActor
final class AuthSession: ObservableObject {
    @Published private(set) var statusMessage = "サインインしていません"
    @Published private(set) var isSignedIn = false
    @Published private(set) var deviceId: String?
    @Published private(set) var isWorking = false

    private let keychain = KeychainStore()
    private var pendingAppleNonce: String?
    private var pendingAccountDeletionNonce: String?
    private var apiClient: APIClient?
    private var apiClientBaseURL: URL?

    init() {
        deviceId = try? keychain.string(for: .deviceId)
        isSignedIn = (try? keychain.string(for: .refreshToken)) != nil
        if isSignedIn {
            statusMessage = "サインイン済みです"
        }
    }

    func handleAppleAuthorization(_ authorization: ASAuthorization) async {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            statusMessage = "Appleの認証情報を確認できませんでした"
            return
        }

        guard let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            statusMessage = "Appleの本人確認情報を確認できませんでした"
            return
        }

        guard let nonce = pendingAppleNonce else {
            statusMessage = "Appleサインインをやり直してください"
            return
        }
        pendingAppleNonce = nil

        await signInAndRegisterDevice(identityToken: identityToken, nonce: nonce)
    }

    func prepareAppleAuthorizationRequest(_ request: ASAuthorizationAppleIDRequest) {
        do {
            let nonce = try Self.generateNonce()
            pendingAppleNonce = nonce
            request.nonce = Self.sha256(nonce)
        } catch {
            pendingAppleNonce = nil
            statusMessage = "Appleサインインを準備できませんでした"
        }
    }

    func handleAppleAuthorizationError(_ error: Error) {
        statusMessage = "Appleサインインを完了できませんでした"
    }

    func requireReauthentication() {
        isSignedIn = false
        statusMessage = "安全のため、Appleで再認証してください"
    }

    func prepareAccountDeletionRequest(_ request: ASAuthorizationAppleIDRequest) {
        do {
            let nonce = try Self.generateNonce()
            pendingAccountDeletionNonce = nonce
            request.nonce = Self.sha256(nonce)
        } catch {
            pendingAccountDeletionNonce = nil
            statusMessage = "削除の本人確認を準備できませんでした"
        }
    }

    func deleteAccount(with authorization: ASAuthorization) async -> Bool {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8),
              let nonce = pendingAccountDeletionNonce,
              let apiBaseURL = AppConstants.apiBaseURL else {
            statusMessage = "削除の本人確認を完了できませんでした"
            return false
        }
        pendingAccountDeletionNonce = nil
        isWorking = true
        defer { isWorking = false }
        do {
            let deleted = try await client(for: apiBaseURL).deleteAccount(
                identityToken: identityToken,
                nonce: nonce
            )
            guard deleted else {
                statusMessage = "アカウントを削除できませんでした"
                return false
            }
            try? keychain.delete(.refreshToken)
            try? keychain.delete(.sessionId)
            try? keychain.delete(.deviceSyncToken)
            try? keychain.delete(.deviceId)
            UserDefaults.standard.set(false, forKey: "onboarding_completed")
            UserDefaults.standard.set(false, forKey: "has_seen_intro")
            deviceId = nil
            isSignedIn = false
            statusMessage = "アカウントとデータを削除しました"
            return true
        } catch {
            handleAuthenticatedRequestError(error, action: "アカウント削除")
            return false
        }
    }

    func verifyContractAPI() async {
        guard let apiBaseURL = AppConstants.apiBaseURL else {
            statusMessage = "配布用の接続設定がありません"
            return
        }

        isWorking = true
        defer { isWorking = false }

        do {
            let items = try await client(for: apiBaseURL).listSubscriptions()
            isSignedIn = true
            statusMessage = "契約を\(items.count)件確認しました"
        } catch {
            handleAuthenticatedRequestError(error, action: "Contract API check")
        }
    }

    func signOutCurrentSession() async {
        guard let apiBaseURL = AppConstants.apiBaseURL else {
            statusMessage = "配布用の接続設定がありません"
            return
        }

        isWorking = true
        defer { isWorking = false }

        do {
            try await client(for: apiBaseURL).signOut()
            isSignedIn = false
            statusMessage = "サインアウトしました"
        } catch {
            isSignedIn = false
            statusMessage = "このiPhoneではサインアウトしました。サーバー側の完了は確認できませんでした"
        }
    }

    func revokeCurrentDevice() async {
        guard let apiBaseURL = AppConstants.apiBaseURL else {
            statusMessage = "配布用の接続設定がありません"
            return
        }
        guard let deviceId else {
            statusMessage = "登録済み端末を確認できませんでした"
            return
        }

        isWorking = true
        defer { isWorking = false }

        do {
            try await client(for: apiBaseURL).revokeDevice(id: deviceId)
            try? keychain.delete(.deviceSyncToken)
            try? keychain.delete(.deviceId)
            self.deviceId = nil
            isSignedIn = false
            statusMessage = "この端末を解除しました"
        } catch {
            handleAuthenticatedRequestError(error, action: "Device revocation")
        }
    }

    private func signInAndRegisterDevice(identityToken: String, nonce: String) async {
        guard let apiBaseURL = AppConstants.apiBaseURL else {
            statusMessage = "配布用の接続設定がありません"
            return
        }

        isWorking = true
        defer { isWorking = false }

        do {
            let clientDeviceId = try loadOrCreateClientDeviceId()
            let client = client(for: apiBaseURL)
            try await client.prepareForNewSignIn()
            let signIn = try await client.signInWithApple(identityToken: identityToken, nonce: nonce)
            if let session = signIn.session {
                try await client.applySession(session)
            }
            let registration = try await client.registerDevice(
                identityToken: identityToken,
                clientDeviceId: clientDeviceId,
                name: AppConstants.defaultDeviceName
            )

            try keychain.set(registration.deviceSyncToken, for: .deviceSyncToken)
            try keychain.set(registration.device.id, for: .deviceId)
            deviceId = registration.device.id
            isSignedIn = true
            statusMessage = "サインインしました"
        } catch {
            if let apiError = error as? APIError, case .reauthenticationRequired = apiError {
                isSignedIn = false
                statusMessage = "Appleで再認証してください"
            } else {
                statusMessage = "サインインを完了できませんでした"
            }
        }
    }

    private func client(for baseURL: URL) -> APIClient {
        if apiClientBaseURL == baseURL, let apiClient {
            return apiClient
        }
        let client = APIClient(baseURL: baseURL)
        apiClient = client
        apiClientBaseURL = baseURL
        return client
    }

    private func handleAuthenticatedRequestError(_ error: Error, action: String) {
        if let apiError = error as? APIError, case .reauthenticationRequired = apiError {
            isSignedIn = false
            statusMessage = "Appleで再認証してください"
        } else {
            statusMessage = "\(action)を完了できませんでした"
        }
    }

    private func loadOrCreateClientDeviceId() throws -> String {
        if let saved = try keychain.string(for: .clientDeviceId) {
            return saved
        }

        let value = UUID().uuidString
        try keychain.set(value, for: .clientDeviceId)
        return value
    }

    private static func generateNonce() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw KeychainError.unhandledStatus(status)
        }
        return Data(bytes).base64EncodedString()
    }

    private static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
