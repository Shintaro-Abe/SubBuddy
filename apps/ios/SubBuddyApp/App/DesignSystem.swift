import SwiftUI
import UIKit

enum AppColor {
    static let background = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.10, green: 0.10, blue: 0.09, alpha: 1)
            : UIColor(red: 0.965, green: 0.957, blue: 0.933, alpha: 1)
    })
    static let surface = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.15, green: 0.15, blue: 0.14, alpha: 1)
            : UIColor(red: 0.992, green: 0.988, blue: 0.976, alpha: 1)
    })
    static let accent = Color(uiColor: UIColor { traits in
        traits.accessibilityContrast == .high
            ? UIColor(red: 0.12, green: 0.24, blue: 0.15, alpha: 1)
            : UIColor(red: 0.278, green: 0.325, blue: 0.278, alpha: 1)
    })
    static let accentOnSurface = Color(uiColor: UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return traits.accessibilityContrast == .high
                ? UIColor(red: 0.78, green: 0.92, blue: 0.80, alpha: 1)
                : UIColor(red: 0.62, green: 0.76, blue: 0.65, alpha: 1)
        }
        return traits.accessibilityContrast == .high
            ? UIColor(red: 0.12, green: 0.24, blue: 0.15, alpha: 1)
            : UIColor(red: 0.278, green: 0.325, blue: 0.278, alpha: 1)
    })
    static let controlTint = accentOnSurface
    static let prominentButtonText = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.08, green: 0.10, blue: 0.08, alpha: 1)
            : .white
    })
    static let secondaryText = Color(uiColor: UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return traits.accessibilityContrast == .high
                ? UIColor(red: 0.92, green: 0.91, blue: 0.88, alpha: 1)
                : UIColor(red: 0.76, green: 0.74, blue: 0.69, alpha: 1)
        }
        return traits.accessibilityContrast == .high
            ? UIColor(red: 0.25, green: 0.23, blue: 0.20, alpha: 1)
            : UIColor(red: 0.435, green: 0.416, blue: 0.361, alpha: 1)
    })
    static let reviewSurface = Color(red: 0.235, green: 0.290, blue: 0.243)
    static let caution = Color(red: 0.451, green: 0.267, blue: 0.169)
    static let line = Color.primary.opacity(0.14)
}

enum AppSpacing {
    static let xSmall: CGFloat = 4
    static let small: CGFloat = 8
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
    static let xLarge: CGFloat = 32
    static let section: CGFloat = 48
}

extension Font {
    static var appDisplay: Font {
        .custom("ShipporiMincho-SemiBold", size: 34, relativeTo: .largeTitle)
    }

    static var appTitle2: Font {
        .custom("ZenKakuGothicNew-Bold", size: 22, relativeTo: .title2)
    }

    static var appTitle: Font {
        .custom("ZenKakuGothicNew-Bold", size: 20, relativeTo: .title3)
    }

    static var appHeadline: Font {
        .custom("ZenKakuGothicNew-Bold", size: 17, relativeTo: .headline)
    }

    static var appBody: Font {
        .custom("ZenKakuGothicNew-Regular", size: 17, relativeTo: .body)
    }

    static var appSubheadline: Font {
        .custom("ZenKakuGothicNew-Regular", size: 15, relativeTo: .subheadline)
    }

    static var appCaption: Font {
        .custom("ZenKakuGothicNew-Regular", size: 13, relativeTo: .caption)
    }

    static var appCaptionBold: Font {
        .custom("ZenKakuGothicNew-Bold", size: 13, relativeTo: .caption)
    }

    static var appCaption2: Font {
        .custom("ZenKakuGothicNew-Regular", size: 12, relativeTo: .caption2)
    }

    static var appFootnote: Font {
        .custom("ZenKakuGothicNew-Regular", size: 13, relativeTo: .footnote)
    }

    static var appMoney: Font {
        .custom("BIZUDPGothic-Regular", size: 34, relativeTo: .largeTitle)
            .monospacedDigit()
    }
}

enum AppTypography {
    static func configureUIKitChrome() {
        let inlineBase = UIFont(name: "ZenKakuGothicNew-Bold", size: 17)
            ?? UIFont.preferredFont(forTextStyle: .headline)
        let largeBase = UIFont(name: "ShipporiMincho-SemiBold", size: 34)
            ?? UIFont.preferredFont(forTextStyle: .largeTitle)
        let tabBase = UIFont(name: "ZenKakuGothicNew-Regular", size: 10)
            ?? UIFont.preferredFont(forTextStyle: .caption2)

        let inline = UIFontMetrics(forTextStyle: .headline).scaledFont(for: inlineBase)
        let large = UIFontMetrics(forTextStyle: .largeTitle).scaledFont(for: largeBase)
        let tab = UIFontMetrics(forTextStyle: .caption2).scaledFont(for: tabBase)

        UINavigationBar.appearance().titleTextAttributes = [.font: inline]
        UINavigationBar.appearance().largeTitleTextAttributes = [.font: large]
        UITabBarItem.appearance().setTitleTextAttributes([.font: tab], for: .normal)
        UITabBarItem.appearance().setTitleTextAttributes([.font: tab], for: .selected)
    }
}

extension View {
    func appPageBackground() -> some View {
        background(AppColor.background.ignoresSafeArea())
    }

    func appListBackground() -> some View {
        scrollContentBackground(.hidden)
            .background(AppColor.background)
    }

    func appProminentButtonStyle() -> some View {
        buttonStyle(.borderedProminent)
            .foregroundStyle(AppColor.prominentButtonText)
    }

    func appAppleSignInButtonSize() -> some View {
        frame(maxWidth: 320)
            .frame(height: 44)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}

struct SurfaceCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(AppSpacing.medium)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppColor.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(AppColor.line, lineWidth: 1)
            }
    }
}

struct ReviewCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(AppSpacing.large)
            .frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(.white)
            .background(AppColor.reviewSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct EmptyStateView: View {
    let title: String
    let message: String
    let systemImage: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: AppSpacing.medium) {
            Image(systemName: systemImage)
                .font(.system(size: 36, weight: .regular))
                .foregroundStyle(AppColor.secondaryText)
                .accessibilityHidden(true)
            Text(title)
                .font(.appTitle)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(.appBody)
                .foregroundStyle(AppColor.secondaryText)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .appProminentButtonStyle()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(AppSpacing.xLarge)
    }
}

struct InlineErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: AppSpacing.small) {
                Label("読み込めませんでした", systemImage: "wifi.exclamationmark")
                    .font(.appHeadline)
                Text(message)
                    .font(.appSubheadline)
                    .foregroundStyle(AppColor.secondaryText)
                Button("もう一度試す", action: retry)
                    .buttonStyle(.bordered)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

struct StatusPill: View {
    let text: String
    var color: Color = AppColor.accent

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text)
        }
        .font(.appCaptionBold)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(color.opacity(0.12), in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

enum AppFormatters {
    static let yen: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.numberStyle = .currency
        formatter.currencyCode = "JPY"
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    static func yen(_ value: Int) -> String {
        yen.string(from: NSNumber(value: value)) ?? "\(value)円"
    }

    static func category(_ value: String) -> String {
        let labels = [
            "video_streaming": "動画配信", "video": "動画", "music": "音楽",
            "productivity": "仕事効率化", "cloud_storage": "クラウドストレージ",
            "storage": "ストレージ", "learning": "学習", "education": "教育",
            "finance": "家計・金融", "membership": "会員サービス", "other": "その他"
        ]
        return labels[value] ?? value
    }

    static func date(_ iso: String?) -> String {
        guard let iso else { return "未入力" }
        let prefix = String(iso.prefix(10))
        let parts = prefix.split(separator: "-")
        guard parts.count == 3 else { return prefix }
        return "\(Int(parts[1]) ?? 0)月\(Int(parts[2]) ?? 0)日"
    }
}
