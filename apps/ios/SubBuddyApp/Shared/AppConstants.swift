import Foundation

enum AppConstants {
    static let appGroupID = "group.com.subbuddy.app"
    static let usageRecordFileName = "usage_records.json"
    static let subscriptionMappingFileName = "subscription_mappings.json"
    static let measurementMutationFileName = "measurement_mutations.json"
    // 承認済み設計では、利用量の判定しきい値を15/30/60/120分に限定する。
    static let thresholdMinutes = [15, 30, 60, 120]
    static let defaultDeviceName = "iPhone"

    static var apiBaseURL: URL? {
        let bundleValue = Bundle.main.object(forInfoDictionaryKey: "SUBBUDDY_API_BASE_URL") as? String ?? ""
        #if DEBUG
        let developerOverride = UserDefaults.standard.string(forKey: "api_base_url") ?? ""
        let rawValue = developerOverride.isEmpty ? bundleValue : developerOverride
        #else
        let rawValue = bundleValue
        #endif
        return validatedAPIBaseURL(rawValue)
    }

    static func validatedAPIBaseURL(_ rawValue: String) -> URL? {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let url = URL(string: trimmed),
              url.scheme?.lowercased() == "https",
              url.host != nil,
              url.user == nil,
              url.password == nil,
              url.query == nil,
              url.fragment == nil else {
            return nil
        }
        return url
    }

    static func localDateString(from date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .autoupdatingCurrent
        return formatter.string(from: date)
    }
}
