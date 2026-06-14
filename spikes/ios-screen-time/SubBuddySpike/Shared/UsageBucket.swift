import Foundation

/// Mac 側の usageDailyBatchSchema に合わせたバケット値（ワイヤ形式）
enum UsageBucket: String, Codable, Comparable {
    case none = "none"
    case m1Plus = "1m_plus"
    case m5Plus = "5m_plus"
    case m15Plus = "15m_plus"
    case m30Plus = "30m_plus"
    case m60Plus = "60m_plus"
    case m120Plus = "120m_plus"

    var wireValue: String { rawValue }

    var lowerMinutes: Int {
        switch self {
        case .none: 0
        case .m1Plus: 1
        case .m5Plus: 5
        case .m15Plus: 15
        case .m30Plus: 30
        case .m60Plus: 60
        case .m120Plus: 120
        }
    }

    var upperMinutes: Int? {
        switch self {
        case .none: nil
        case .m1Plus: 4
        case .m5Plus: 14
        case .m15Plus: 29
        case .m30Plus: 59
        case .m60Plus: 119
        case .m120Plus: nil
        }
    }

    static func fromMinutes(_ minutes: Int) -> UsageBucket {
        if minutes >= 120 { return .m120Plus }
        if minutes >= 60 { return .m60Plus }
        if minutes >= 30 { return .m30Plus }
        if minutes >= 15 { return .m15Plus }
        if minutes >= 5 { return .m5Plus }
        if minutes >= 1 { return .m1Plus }
        return .none
    }

    private var sortOrder: Int {
        switch self {
        case .none: 0
        case .m1Plus: 1
        case .m5Plus: 2
        case .m15Plus: 3
        case .m30Plus: 4
        case .m60Plus: 5
        case .m120Plus: 6
        }
    }

    static func < (lhs: UsageBucket, rhs: UsageBucket) -> Bool {
        lhs.sortOrder < rhs.sortOrder
    }
}
