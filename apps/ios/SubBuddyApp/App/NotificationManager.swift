import Foundation
import UIKit
import UserNotifications

enum NotificationClientState: Equatable {
    case notConfigured
    case requesting
    case active
    case osDisabled
    case preparing
    case temporaryFailure
    case disabledOnDevice

    var label: String {
        switch self {
        case .notConfigured: return "未設定"
        case .requesting: return "許可を確認中"
        case .active: return "このiPhoneで有効"
        case .osDisabled: return "OS設定で停止中"
        case .preparing: return "配信準備中"
        case .temporaryFailure: return "一時的な問題"
        case .disabledOnDevice: return "このiPhoneでは停止"
        }
    }
}

struct NotificationPreferences: Codable, Equatable {
    var yearlyRenewalEnabled: Bool
    var monthlyRenewalEnabled: Bool
    var syncFailureEnabled: Bool
    var newSignInPushEnabled: Bool

    static let disabled = NotificationPreferences(
        yearlyRenewalEnabled: false,
        monthlyRenewalEnabled: false,
        syncFailureEnabled: false,
        newSignInPushEnabled: true
    )
}

struct NotificationPreferencesEnvelope: Decodable {
    let enabled: Bool
    let preferences: NotificationPreferences
    let promptDismissedAt: String?

    private enum CodingKeys: String, CodingKey {
        case enabled
        case preferences
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decode(Bool.self, forKey: .enabled)
        preferences = try container.decode(NotificationPreferences.self, forKey: .preferences)
        let raw = try container.decodeIfPresent(RawPreferences.self, forKey: .preferences)
        promptDismissedAt = raw?.promptDismissedAt
    }

    private struct RawPreferences: Decodable {
        let promptDismissedAt: String?
    }
}

struct NotificationPreferencePatch: Encodable {
    let yearlyRenewalEnabled: Bool?
    let monthlyRenewalEnabled: Bool?
    let syncFailureEnabled: Bool?
    let newSignInPushEnabled: Bool?
    let promptDismissed: Bool?
}

struct PushTokenRequest: Encodable {
    let token: String
    let environment: String
    let deliveryEnabled: Bool
    let timeZone: String
}

struct PushTokenResponse: Decodable {
    let registered: Bool
}

struct PushTokenRemovalResponse: Decodable {
    let removed: Bool
}

struct NotificationNotice: Decodable, Identifiable, Equatable {
    let id: String
    let kind: String
    let templateKey: String
    let safeArguments: SafeArguments?
    let eventAt: String
    let readAt: String?

    struct SafeArguments: Decodable, Equatable {
        let clientType: String?
    }

    var title: String {
        switch kind {
        case "new_sign_in": return "新しいサインイン"
        case "account_deletion_scheduled": return "アカウントに関する重要なお知らせ"
        default: return "安全性・サービス状況のお知らせ"
        }
    }

    var detail: String {
        switch kind {
        case "new_sign_in":
            return "\(safeArguments?.clientType ?? "新しい端末")からサインインがありました。心当たりがない場合は端末とセッションを確認してください。"
        case "account_deletion_scheduled":
            return "削除予定と対応方法を確認してください。"
        default:
            return "安全性または長期障害に関する内容を確認してください。"
        }
    }
}

struct NotificationNoticeCollection: Decodable {
    let items: [NotificationNotice]
}

struct NoticeReadResponse: Decodable {
    let read: Bool
}

struct RenewalScheduleItem: Equatable {
    let subscriptionId: String
    let billingCycle: BillingCycle
    let anchorDate: Date
}

enum RenewalScheduleCalculator {
    static func upcomingDate(
        anchor: Date,
        cycle: BillingCycle,
        asOf: Date = Date(),
        calendar sourceCalendar: Calendar = .autoupdatingCurrent
    ) -> Date? {
        var calendar = sourceCalendar
        calendar.timeZone = sourceCalendar.timeZone
        let today = calendar.startOfDay(for: asOf)
        let anchorDay = calendar.startOfDay(for: anchor)
        if anchorDay >= today { return anchorDay }

        let anchorComponents = calendar.dateComponents([.year, .month, .day], from: anchorDay)
        guard let anchorYear = anchorComponents.year,
              let anchorMonth = anchorComponents.month,
              let anchorDateNumber = anchorComponents.day else { return nil }
        let anchorRange = calendar.range(of: .day, in: .month, for: anchorDay)
        let isMonthEnd = anchorDateNumber == anchorRange?.count

        var offset = 1
        let limit = cycle == .monthly ? 2_400 : 200
        while offset <= limit {
            let absoluteMonth =
                cycle == .monthly
                ? anchorYear * 12 + (anchorMonth - 1) + offset
                : (anchorYear + offset) * 12 + (anchorMonth - 1)
            var targetComponents = DateComponents()
            targetComponents.calendar = calendar
            targetComponents.timeZone = calendar.timeZone
            targetComponents.year = absoluteMonth / 12
            targetComponents.month = absoluteMonth % 12 + 1
            targetComponents.day = 1
            if let firstDay = calendar.date(from: targetComponents) {
                let targetRange = calendar.range(of: .day, in: .month, for: firstDay)
                let targetDay = isMonthEnd
                    ? targetRange?.count
                    : min(anchorDateNumber, targetRange?.count ?? anchorDateNumber)
                var components = calendar.dateComponents([.year, .month], from: firstDay)
                components.day = targetDay
                if let candidate = calendar.date(from: components),
                   candidate >= today {
                    return candidate
                }
            }
            offset += 1
        }
        return nil
    }
}

enum LocalNotificationScheduler {
    static let renewalPrefix = "subbuddy.renewal."
    static let syncFailureIdentifier = "subbuddy.sync-failure.unresolved"
    static let maximumRenewalRequests = 60

    static func rebuildRenewalNotifications(
        items: [RenewalScheduleItem],
        preferences: NotificationPreferences,
        center: UNUserNotificationCenter = .current(),
        calendar: Calendar = .autoupdatingCurrent,
        now: Date = Date()
    ) async {
        let existing = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: existing.map(\.identifier).filter { $0.hasPrefix(renewalPrefix) }
        )

        let requests = items.compactMap { item -> (Date, UNNotificationRequest)? in
            let enabled = item.billingCycle == .yearly
                ? preferences.yearlyRenewalEnabled
                : preferences.monthlyRenewalEnabled
            guard enabled,
                  let renewal = RenewalScheduleCalculator.upcomingDate(
                    anchor: item.anchorDate,
                    cycle: item.billingCycle,
                    asOf: now,
                    calendar: calendar
                  ) else { return nil }
            let leadDays = item.billingCycle == .yearly ? 7 : 1
            guard let reminderDay = calendar.date(byAdding: .day, value: -leadDays, to: renewal) else {
                return nil
            }
            var components = calendar.dateComponents([.year, .month, .day], from: reminderDay)
            components.hour = 10
            components.minute = 0
            guard let fireDate = calendar.date(from: components), fireDate > now else { return nil }
            let content = UNMutableNotificationContent()
            content.title = "更新日を確認しましょう"
            content.body = "更新日が近い契約があります。"
            content.sound = .default
            content.userInfo = ["route": "renewals"]
            let identifier = "\(renewalPrefix)\(item.subscriptionId).\(components.year ?? 0)-\(components.month ?? 0)-\(components.day ?? 0)"
            return (
                fireDate,
                UNNotificationRequest(
                    identifier: identifier,
                    content: content,
                    trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                )
            )
        }
        .sorted { $0.0 < $1.0 }
        .prefix(maximumRenewalRequests)

        for (_, request) in requests {
            try? await center.add(request)
        }
    }

    static func cancelRenewalNotifications(
        center: UNUserNotificationCenter = .current()
    ) async {
        let existing = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: existing.map(\.identifier).filter { $0.hasPrefix(renewalPrefix) }
        )
    }

    static func scheduleSyncFailureIfNeeded(
        center: UNUserNotificationCenter = .current(),
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) async {
        guard UserDefaults.standard.bool(forKey: "notification_sync_failure_enabled"),
              UserDefaults.standard.bool(forKey: "notification_delivery_on_device")
        else { return }
        let existing = await center.pendingNotificationRequests()
        guard !existing.contains(where: { $0.identifier == syncFailureIdentifier }) else { return }
        var fireDate = now.addingTimeInterval(24 * 60 * 60)
        let hour = calendar.component(.hour, from: fireDate)
        if hour >= 20 || hour < 9 {
            var next = calendar.dateComponents([.year, .month, .day], from: fireDate)
            if hour >= 20, let tomorrow = calendar.date(byAdding: .day, value: 1, to: fireDate) {
                next = calendar.dateComponents([.year, .month, .day], from: tomorrow)
            }
            next.hour = 9
            next.minute = 0
            fireDate = calendar.date(from: next) ?? fireDate
        }
        let content = UNMutableNotificationContent()
        content.title = "同期を確認してください"
        content.body = "同期できていない記録があります。"
        content.sound = .default
        content.userInfo = ["route": "sync"]
        try? await center.add(
            UNNotificationRequest(
                identifier: syncFailureIdentifier,
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(
                    timeInterval: max(1, fireDate.timeIntervalSince(now)),
                    repeats: false
                )
            )
        )
    }

    static func cancelSyncFailure(center: UNUserNotificationCenter = .current()) {
        center.removePendingNotificationRequests(withIdentifiers: [syncFailureIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [syncFailureIdentifier])
    }

    static func clearAll(center: UNUserNotificationCenter = .current()) {
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        UserDefaults.standard.removeObject(forKey: "notification_delivery_on_device")
        UserDefaults.standard.removeObject(forKey: "apns_device_token")
    }
}

@MainActor
final class NotificationManager: ObservableObject {
    @Published private(set) var preferences = NotificationPreferences.disabled
    @Published private(set) var state: NotificationClientState = .notConfigured
    @Published private(set) var notices: [NotificationNotice] = []
    @Published private(set) var errorMessage: String?
    @Published private(set) var featureEnabled = false

    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    func refresh(
        subscriptions: [Subscription],
        deviceId: String?
    ) async {
        guard let baseURL = AppConstants.apiBaseURL else { return }
        state = .preparing
        errorMessage = nil
        do {
            let client = APIClient(baseURL: baseURL)
            let envelope = try await client.notificationPreferences()
            featureEnabled = envelope.enabled
            preferences = envelope.preferences
            if envelope.promptDismissedAt != nil {
                UserDefaults.standard.set(true, forKey: "notification_prompt_dismissed")
            }
            persistPreferences()
            notices = try await client.notificationNotices()
            let settings = await center.notificationSettings()
            guard envelope.enabled else {
                await LocalNotificationScheduler.cancelRenewalNotifications(center: center)
                LocalNotificationScheduler.cancelSyncFailure(center: center)
                state = .notConfigured
                return
            }
            guard settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional else {
                await LocalNotificationScheduler.cancelRenewalNotifications(center: center)
                state = settings.authorizationStatus == .denied ? .osDisabled : .notConfigured
                return
            }
            guard deviceId != nil else {
                state = .preparing
                return
            }
            let deliveryOnDevice = UserDefaults.standard.bool(
                forKey: "notification_delivery_on_device"
            )
            if deliveryOnDevice {
                UIApplication.shared.registerForRemoteNotifications()
                await registerStoredPushToken(deviceId: deviceId)
                await rebuildRenewals(subscriptions)
                state = .active
            } else {
                await LocalNotificationScheduler.cancelRenewalNotifications(center: center)
                LocalNotificationScheduler.cancelSyncFailure(center: center)
                state = .disabledOnDevice
            }
        } catch {
            state = .temporaryFailure
            errorMessage = "通知の状態を確認できませんでした。"
        }
    }

    func requestPermission(subscriptions: [Subscription], deviceId: String?) async {
        state = .requesting
        errorMessage = nil
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                UserDefaults.standard.set(true, forKey: "notification_delivery_on_device")
                UIApplication.shared.registerForRemoteNotifications()
                await refresh(subscriptions: subscriptions, deviceId: deviceId)
            } else {
                state = .osDisabled
            }
        } catch {
            state = .temporaryFailure
            errorMessage = "通知の許可を確認できませんでした。"
        }
    }

    func update(
        keyPath: WritableKeyPath<NotificationPreferences, Bool>,
        preferenceKey: String,
        value: Bool,
        subscriptions: [Subscription],
        deviceId: String?
    ) async {
        guard let baseURL = AppConstants.apiBaseURL else { return }
        var updated = preferences
        updated[keyPath: keyPath] = value
        state = .preparing
        do {
            let client = APIClient(baseURL: baseURL)
            preferences = try await client.updateNotificationPreference(
                key: preferenceKey,
                value: value
            )
            persistPreferences()
            await rebuildRenewals(subscriptions)
            if value {
                await requestPermission(subscriptions: subscriptions, deviceId: deviceId)
            } else {
                await refresh(subscriptions: subscriptions, deviceId: deviceId)
            }
        } catch {
            state = .temporaryFailure
            errorMessage = "通知の希望を保存できませんでした。"
        }
    }

    func markRead(_ notice: NotificationNotice) async {
        guard let baseURL = AppConstants.apiBaseURL else { return }
        do {
            let client = APIClient(baseURL: baseURL)
            try await client.markNoticeRead(id: notice.id)
            notices = notices.map {
                $0.id == notice.id
                    ? NotificationNotice(
                        id: $0.id,
                        kind: $0.kind,
                        templateKey: $0.templateKey,
                        safeArguments: $0.safeArguments,
                        eventAt: $0.eventAt,
                        readAt: ISO8601DateFormatter().string(from: Date())
                    )
                    : $0
            }
        } catch {
            errorMessage = "お知らせを更新できませんでした。"
        }
    }

    func dismissPrompt() async {
        guard let baseURL = AppConstants.apiBaseURL else { return }
        do {
            try await APIClient(baseURL: baseURL).dismissNotificationPrompt()
        } catch {
            errorMessage = "通知案内の状態を保存できませんでした。"
        }
    }

    func setDeliveryOnThisDevice(
        _ enabled: Bool,
        subscriptions: [Subscription],
        deviceId: String?
    ) async {
        if enabled {
            UserDefaults.standard.set(true, forKey: "notification_delivery_on_device")
            await requestPermission(subscriptions: subscriptions, deviceId: deviceId)
            return
        }
        if let baseURL = AppConstants.apiBaseURL,
           let deviceId,
           let token = UserDefaults.standard.string(forKey: "apns_device_token") {
            try? await APIClient(baseURL: baseURL).registerPushToken(
                deviceId: deviceId,
                token: token,
                deliveryEnabled: false
            )
        }
        UserDefaults.standard.set(false, forKey: "notification_delivery_on_device")
        await LocalNotificationScheduler.cancelRenewalNotifications(center: center)
        LocalNotificationScheduler.cancelSyncFailure(center: center)
        state = .disabledOnDevice
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func persistPreferences() {
        UserDefaults.standard.set(preferences.yearlyRenewalEnabled, forKey: "notification_yearly_renewal_enabled")
        UserDefaults.standard.set(preferences.monthlyRenewalEnabled, forKey: "notification_monthly_renewal_enabled")
        UserDefaults.standard.set(preferences.syncFailureEnabled, forKey: "notification_sync_failure_enabled")
    }

    private func rebuildRenewals(_ subscriptions: [Subscription]) async {
        let formatter = ISO8601DateFormatter()
        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.dateFormat = "yyyy-MM-dd"
        let items = subscriptions.compactMap { subscription -> RenewalScheduleItem? in
            guard subscription.status == .active,
                  let raw = subscription.nextRenewalDate,
                  let anchor = formatter.date(from: raw) ?? dateOnly.date(from: String(raw.prefix(10)))
            else { return nil }
            return RenewalScheduleItem(
                subscriptionId: subscription.id,
                billingCycle: subscription.billingCycle,
                anchorDate: anchor
            )
        }
        await LocalNotificationScheduler.rebuildRenewalNotifications(
            items: items,
            preferences: preferences
        )
    }

    private func registerStoredPushToken(deviceId: String?) async {
        guard let deviceId,
              UserDefaults.standard.bool(forKey: "notification_delivery_on_device"),
              let token = UserDefaults.standard.string(forKey: "apns_device_token"),
              let baseURL = AppConstants.apiBaseURL else { return }
        do {
            let client = APIClient(baseURL: baseURL)
            try await client.registerPushToken(deviceId: deviceId, token: token)
        } catch {
            errorMessage = "プッシュ通知の準備が完了していません。"
        }
    }
}

extension Notification.Name {
    static let subBuddyPushTokenChanged = Notification.Name("subbuddy.push-token-changed")
}

final class NotificationAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        UserDefaults.standard.set(
            deviceToken.map { String(format: "%02x", $0) }.joined(),
            forKey: "apns_device_token"
        )
        NotificationCenter.default.post(name: .subBuddyPushTokenChanged, object: nil)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        UserDefaults.standard.removeObject(forKey: "apns_device_token")
        NotificationCenter.default.post(name: .subBuddyPushTokenChanged, object: nil)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard let route = response.notification.request.content.userInfo["route"] as? String else {
            return
        }
        UserDefaults.standard.set(route, forKey: "pending_notification_route")
    }
}
