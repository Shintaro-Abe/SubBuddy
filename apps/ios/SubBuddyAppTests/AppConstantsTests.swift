import Foundation
import XCTest
@testable import SubBuddyApp

final class AppConstantsTests: XCTestCase {
    func testAPIBaseURLRequiresHTTPS() {
        XCTAssertNil(AppConstants.validatedAPIBaseURL("http://example.test"))
        XCTAssertEqual(
            AppConstants.validatedAPIBaseURL("https://example.test")?.absoluteString,
            "https://example.test"
        )
    }

    func testAPIBaseURLRejectsCredentialsQueryAndFragment() {
        let credentialURL = "https://synthetic-user" + "@example.test"
        XCTAssertNil(AppConstants.validatedAPIBaseURL(credentialURL))
        XCTAssertNil(AppConstants.validatedAPIBaseURL("https://example.test?token=synthetic"))
        XCTAssertNil(AppConstants.validatedAPIBaseURL("https://example.test#fragment"))
    }
}

final class APIClientTests: XCTestCase {
    func testSharedClientReusesInstanceForSameBaseURL() {
        let baseURL = URL(string: "https://shared-client.synthetic.invalid")!

        let first = APIClient.shared(for: baseURL)
        let second = APIClient.shared(for: baseURL)

        XCTAssertTrue(first === second)
    }

    func testSharedClientSeparatesDifferentBaseURLs() {
        let first = APIClient.shared(
            for: URL(string: "https://shared-client-a.synthetic.invalid")!
        )
        let second = APIClient.shared(
            for: URL(string: "https://shared-client-b.synthetic.invalid")!
        )

        XCTAssertFalse(first === second)
    }

    func testConcurrentSharedClientRequestsReuseOneInstance() async throws {
        let baseURL = URL(string: "https://shared-client-concurrent.synthetic.invalid")!
        let clients = await withTaskGroup(of: APIClient.self, returning: [APIClient].self) { group in
            for _ in 0..<20 {
                group.addTask {
                    APIClient.shared(for: baseURL)
                }
            }

            var values: [APIClient] = []
            for await client in group {
                values.append(client)
            }
            return values
        }

        let first = try XCTUnwrap(clients.first)
        XCTAssertEqual(clients.count, 20)
        XCTAssertTrue(clients.allSatisfy { $0 === first })
    }

    func testApplySessionClearsPartialKeychainWrite() async {
        let keychain = FailingKeychainStore(failingSetKey: .sessionId)
        let client = APIClient(
            baseURL: URL(string: "https://synthetic.invalid")!,
            keychain: keychain
        )
        let session = AppleSignInResponse.Session(
            sessionId: "synthetic-session",
            accessToken: "synthetic-access-token",
            accessExpiresAt: "2026-07-16T12:15:00.000Z",
            refreshToken: "synthetic-refresh-token",
            refreshIdleExpiresAt: "2026-08-15T12:00:00.000Z",
            refreshAbsoluteExpiresAt: "2026-10-14T12:00:00.000Z"
        )

        do {
            try await client.applySession(session)
            XCTFail("Expected the Keychain write to fail")
        } catch {
            XCTAssertNil(keychain.values[.refreshToken])
            XCTAssertNil(keychain.values[.sessionId])
        }
    }
}

private final class FailingKeychainStore: KeychainStoring {
    var values: [KeychainStore.Key: String] = [:]
    private let failingSetKey: KeychainStore.Key

    init(failingSetKey: KeychainStore.Key) {
        self.failingSetKey = failingSetKey
    }

    func string(for key: KeychainStore.Key) throws -> String? {
        values[key]
    }

    func set(_ value: String, for key: KeychainStore.Key) throws {
        if key == failingSetKey {
            throw SyntheticKeychainError.writeFailed
        }
        values[key] = value
    }

    func delete(_ key: KeychainStore.Key) throws {
        values[key] = nil
    }
}

private enum SyntheticKeychainError: Error {
    case writeFailed
}
