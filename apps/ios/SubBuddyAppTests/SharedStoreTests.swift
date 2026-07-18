import XCTest
@testable import SubBuddyApp

final class SharedStoreTests: XCTestCase {
    private var directoryURL: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        fileURL = directoryURL.appendingPathComponent("usage_records.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directoryURL)
    }

    func testConcurrentUpsertsDoNotLoseRecords() {
        let store = SharedStore(fileURL: fileURL)
        let queue = DispatchQueue(label: "SharedStoreTests", attributes: .concurrent)
        let group = DispatchGroup()

        for index in 0..<40 {
            group.enter()
            queue.async {
                store.upsert(
                    activityId: "synthetic_activity_\(index)",
                    eventId: "synthetic_event_15m",
                    date: "2099-01-01",
                    bucket: .m15Plus
                )
                group.leave()
            }
        }

        XCTAssertEqual(group.wait(timeout: .now() + 5), .success)
        XCTAssertEqual(store.readAll().count, 40)
    }

    func testAcknowledgementDoesNotDeleteNewerUpdate() {
        let store = SharedStore(fileURL: fileURL)
        store.upsert(
            activityId: "synthetic_activity",
            eventId: "synthetic_event_15m",
            date: "2099-01-01",
            bucket: .m15Plus
        )
        let sentSnapshot = store.readAll()

        store.upsert(
            activityId: "synthetic_activity",
            eventId: "synthetic_event_30m",
            date: "2099-01-01",
            bucket: .m30Plus
        )
        store.removeAcknowledged(sentSnapshot)

        XCTAssertEqual(store.readAll().map(\.bucket), [.m30Plus])
    }

    func testAcknowledgementDeletesUnchangedRecord() {
        let store = SharedStore(fileURL: fileURL)
        store.upsert(
            activityId: "synthetic_activity",
            eventId: "synthetic_event_15m",
            date: "2099-01-01",
            bucket: .m15Plus
        )
        let sentSnapshot = store.readAll()

        store.removeAcknowledged(sentSnapshot)

        XCTAssertTrue(store.readAll().isEmpty)
    }

    func testRemovingActivityDeletesOnlyItsRecords() {
        let store = SharedStore(fileURL: fileURL)
        store.upsert(
            activityId: "synthetic_removed",
            eventId: "synthetic_event_15m",
            date: "2099-01-01",
            bucket: .m15Plus
        )
        store.upsert(
            activityId: "synthetic_kept",
            eventId: "synthetic_event_30m",
            date: "2099-01-01",
            bucket: .m30Plus
        )

        XCTAssertTrue(store.remove(activityId: "synthetic_removed"))

        XCTAssertEqual(store.readAll().map(\.activityId), ["synthetic_kept"])
    }
}
