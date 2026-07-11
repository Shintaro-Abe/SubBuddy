import Foundation

struct APIClient {
    let baseURL: URL

    func signInWithApple(identityToken: String) async throws -> AppleSignInResponse {
        try await send(
            path: "/api/auth/apple/native",
            method: "POST",
            body: AppleSignInRequest(identityToken: identityToken)
        )
    }

    func registerDevice(identityToken: String, clientDeviceId: String, name: String) async throws -> DeviceRegistrationResponse {
        try await send(
            path: "/api/devices",
            method: "POST",
            body: DeviceRegistrationRequest(
                identityToken: identityToken,
                name: name,
                clientDeviceId: clientDeviceId
            )
        )
    }

    private func send<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        method: String,
        body: RequestBody
    ) async throws -> ResponseBody {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
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
}

struct AppleSignInResponse: Decodable {
    let actor: Actor

    struct Actor: Decodable {
        let kind: String
        let userId: String
        let authProvider: String
    }
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

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL."
        case .invalidResponse:
            return "Invalid API response."
        case .httpStatus(let statusCode):
            return "API request failed with status \(statusCode)."
        }
    }
}
