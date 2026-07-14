import AuthenticationServices
import CryptoKit
import Foundation
import Security

@MainActor
final class AuthSession: ObservableObject {
    @Published private(set) var statusMessage = "Not signed in"
    @Published private(set) var isSignedIn = false
    @Published private(set) var deviceId: String?
    @Published private(set) var isWorking = false

    private let keychain = KeychainStore()
    private var pendingAppleNonce: String?

    init() {
        deviceId = try? keychain.string(for: .deviceId)
        isSignedIn = (try? keychain.string(for: .refreshToken)) != nil ||
            (try? keychain.string(for: .deviceSyncToken)) != nil
        if isSignedIn {
            statusMessage = "Device token is saved"
        }
    }

    func handleAppleAuthorization(_ authorization: ASAuthorization) async {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            statusMessage = "Apple credential is unavailable"
            return
        }

        guard let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            statusMessage = "Apple identity token is unavailable"
            return
        }

        guard let nonce = pendingAppleNonce else {
            statusMessage = "Apple sign-in request is unavailable"
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
            statusMessage = "Apple sign-in request could not be prepared"
        }
    }

    func handleAppleAuthorizationError(_ error: Error) {
        statusMessage = "Sign in failed: \(error.localizedDescription)"
    }

    private func signInAndRegisterDevice(identityToken: String, nonce: String) async {
        guard let apiBaseURL = AppConstants.apiBaseURL else {
            statusMessage = "API base URL is not configured"
            return
        }

        isWorking = true
        defer { isWorking = false }

        do {
            let clientDeviceId = try loadOrCreateClientDeviceId()
            let client = APIClient(baseURL: apiBaseURL)
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
            statusMessage = "Signed in and device registered"
        } catch {
            if let apiError = error as? APIError, case .reauthenticationRequired = apiError {
                isSignedIn = false
                userId = nil
                statusMessage = "Sign in with Apple is required again"
            } else {
                statusMessage = "Sign in failed: \(error.localizedDescription)"
            }
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
