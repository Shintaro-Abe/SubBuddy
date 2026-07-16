import Foundation
import XCTest
@testable import SubBuddyApp

final class APIClientTests: XCTestCase {
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
