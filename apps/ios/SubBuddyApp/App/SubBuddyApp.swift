import SwiftUI

@main
struct SubBuddyApp: App {
    @UIApplicationDelegateAdaptor(NotificationAppDelegate.self) private var notificationDelegate

    init() {
        AppTypography.configureUIKitChrome()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
