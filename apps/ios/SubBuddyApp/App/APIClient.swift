import Foundation

actor APIClient {
    let baseURL: URL

    private let keychain: KeychainStore
    private var accessToken: String?
    private var refreshTask: Task<AppleSignInResponse.Session, Error>?

    init(baseURL: URL, keychain: KeychainStore = KeychainStore()) {
        self.baseURL = baseURL
        self.keychain = keychain
    }

    func signInWithApple(identityToken: String, nonce: String) async throws -> AppleSignInResponse {
        try await send(
            path: "/api/auth/apple/native",
            method: "POST",
            body: AppleSignInRequest(identityToken: identityToken, nonce: nonce)
        )
    }

    func applySession(_ session: AppleSignInResponse.Session) throws {
        accessToken = session.accessToken
        try? keychain.delete(.accessToken)
        try keychain.set(session.refreshToken, for: .refreshToken)
        try keychain.set(session.sessionId, for: .sessionId)
    }

    func registerDevice(identityToken: String, clientDeviceId: String, name: String) async throws -> DeviceRegistrationResponse {
        let body = DeviceRegistrationRequest(
            identityToken: identityToken,
            name: name,
            clientDeviceId: clientDeviceId
        )
        if accessToken != nil || (try keychain.string(for: .refreshToken)) != nil {
            return try await sendAuthenticated(path: "/api/devices", method: "POST", body: body)
        }
        return try await send(path: "/api/devices", method: "POST", body: body)
    }

    func signOut() async throws {
        let _: SignOutResponse = try await sendAuthenticated(
            path: "/api/auth/logout",
            method: "POST",
            body: EmptyRequest()
        )
        clearSession()
    }

    private func sendAuthenticated<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        method: String,
        body: RequestBody
    ) async throws -> ResponseBody {
        if accessToken == nil {
            _ = try await refreshSession()
        }
        let attemptedAccessToken = accessToken

        do {
            return try await send(path: path, method: method, body: body, bearerToken: attemptedAccessToken)
        } catch APIError.httpStatus(401) {
            if accessToken == attemptedAccessToken {
                _ = try await refreshSession()
            }
            return try await send(path: path, method: method, body: body, bearerToken: accessToken)
        }
    }

    private func refreshSession() async throws -> AppleSignInResponse.Session {
        if let refreshTask {
            return try await refreshTask.value
        }
        guard let refreshToken = try keychain.string(for: .refreshToken) else {
            clearSession()
            throw APIError.reauthenticationRequired
        }

        let task = Task { [baseURL] in
            guard let url = URL(string: "/api/auth/refresh", relativeTo: baseURL)?.absoluteURL else {
                throw APIError.invalidURL
            }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(RefreshRequest(refreshToken: refreshToken))
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            guard (200...299).contains(httpResponse.statusCode) else {
                throw APIError.httpStatus(httpResponse.statusCode)
            }
            return try JSONDecoder().decode(RefreshResponse.self, from: data).session
        }
        refreshTask = task

        do {
            let session = try await task.value
            refreshTask = nil
            try applySession(session)
            return session
        } catch APIError.httpStatus(let statusCode) where statusCode == 401 || statusCode == 403 {
            refreshTask = nil
            clearSession()
            throw APIError.reauthenticationRequired
        } catch {
            refreshTask = nil
            throw error
        }
    }

    private func clearSession() {
        accessToken = nil
        try? keychain.delete(.accessToken)
        try? keychain.delete(.refreshToken)
        try? keychain.delete(.sessionId)
    }

    private func send<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        method: String,
        body: RequestBody,
        bearerToken: String? = nil
    ) async throws -> ResponseBody {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpStatus(httpResponse.statusCode)
        }
        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }
}

struct AppleSignInRequest: Encodable {
    let identityToken: String
    let nonce: String
}

struct AppleSignInResponse: Decodable {
    let actor: Actor
    let session: Session?

    struct Actor: Decodable {
        let kind: String
        let userId: String
        let authProvider: String
    }

    struct Session: Codable {
        let sessionId: String
        let accessToken: String
        let accessExpiresAt: String
        let refreshToken: String
        let refreshIdleExpiresAt: String
        let refreshAbsoluteExpiresAt: String
    }
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct RefreshResponse: Decodable {
    let session: AppleSignInResponse.Session
}

struct DeviceRegistrationRequest: Encodable {
    let identityToken: String
    let name: String
    let clientDeviceId: String
}

struct DeviceRegistrationResponse: Decodable {
    let device: Device
    let deviceSyncToken: String

    struct Device: Decodable {
        let id: String
        let name: String?
    }
}

struct EmptyRequest: Encodable {}

struct SignOutResponse: Decodable {
    let signedOut: Bool
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpStatus(Int)
    case reauthenticationRequired

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL."
        case .invalidResponse:
            return "Invalid API response."
        case .httpStatus(let statusCode):
            return "API request failed with status \(statusCode)."
        case .reauthenticationRequired:
            return "Sign in with Apple is required again."
        }
    }
}
