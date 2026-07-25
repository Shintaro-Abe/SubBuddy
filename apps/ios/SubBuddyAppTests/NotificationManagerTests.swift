import XCTest
@testable import SubBuddyApp

final class NotificationManagerTests: XCTestCase {
    private var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func date(_ value: String) -> Date {
        let formatter = DateFormatter()
        formatter.calendar = utcCalendar
        formatter.timeZone = utcCalendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)!
    }

    func testMonthlyMonthEndStaysAtMonthEnd() {
        let result = RenewalScheduleCalculator.upcomingDate(
            anchor: date("2026-01-31"),
            cycle: .monthly,
            asOf: date("2026-02-01"),
            calendar: utcCalendar
        )

        XCTAssertEqual(result, date("2026-02-28"))
    }

    func testMonthlyNonMonthEndReturnsToOriginalDay() {
        let result = RenewalScheduleCalculator.upcomingDate(
            anchor: date("2026-01-30"),
            cycle: .monthly,
            asOf: date("2026-03-01"),
            calendar: utcCalendar
        )

        XCTAssertEqual(result, date("2026-03-30"))
    }

    func testYearlyLeapDayUsesFebruaryEndInOrdinaryYear() {
        let result = RenewalScheduleCalculator.upcomingDate(
            anchor: date("2024-02-29"),
            cycle: .yearly,
            asOf: date("2025-01-01"),
            calendar: utcCalendar
        )

        XCTAssertEqual(result, date("2025-02-28"))
    }

    func testNoticeCopyDoesNotExposeContractInformation() {
        let notice = NotificationNotice(
            id: "synthetic-notice",
            kind: "account_deletion_scheduled",
            templateKey: "account_deletion_scheduled",
            safeArguments: nil,
            eventAt: "2026-07-23T00:00:00.000Z",
            readAt: nil
        )

        XCTAssertEqual(notice.title, "アカウントに関する重要なお知らせ")
        XCTAssertFalse(notice.detail.contains("円"))
        XCTAssertFalse(notice.detail.contains("更新日"))
    }
}
