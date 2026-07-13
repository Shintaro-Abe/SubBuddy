import Foundation

enum AppConstants {
    static let appGroupID = "group.com.subbuddy.app"
    static let usageRecordFileName = "usage_records.json"
    static let subscriptionMappingFileName = "subscription_mappings.json"
    static let thresholdMinutes = [15, 30, 60, 120]

    static var apiBaseURL: URL? {
        let userValue = UserDefaults.standard.string(forKey: "api_base_url") ?? ""
        let bundleValue = Bundle.main.object(forInfoDictionaryKey: "SUBBUDDY_API_BASE_URL") as? String ?? ""
        let rawValue = userValue.isEmpty ? bundleValue : userValue
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return URL(string: trimmed)
    }
}
