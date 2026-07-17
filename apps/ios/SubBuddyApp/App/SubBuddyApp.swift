import SwiftUI

@main
struct SubBuddyApp: App {
    init() {
        AppTypography.configureUIKitChrome()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
