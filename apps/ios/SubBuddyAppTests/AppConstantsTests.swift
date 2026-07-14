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
