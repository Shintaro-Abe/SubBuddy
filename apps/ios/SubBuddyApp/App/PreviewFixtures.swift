import Foundation
import SwiftUI

enum PreviewFixtures {
    static let video = Subscription(
        id: "synthetic-video",
        name: "動画サービス",
        normalizedName: "synthetic-video",
        category: "video_streaming",
        amount: 1_000,
        currency: "JPY",
        billingCycle: .monthly,
        nextRenewalDate: "2026-07-21T00:00:00.000Z",
        signupChannel: "App Store",
        status: .active,
        importance: 3,
        cancellationUrl: "https://example.invalid/account",
        notes: "合成データ",
        matchedServiceId: "synthetic-catalog-video",
        usageType: "active_foreground",
        initialValueAnswer: "somewhat",
        planCapacityGb: nil,
        usedCapacityGb: nil,
        capacityCheckedAt: nil,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-07-16T09:38:00.000Z"
    )

    static let cloud = Subscription(
        id: "synthetic-cloud",
        name: "クラウドストレージ",
        normalizedName: "synthetic-cloud",
        category: "cloud_storage",
        amount: 400,
        currency: "JPY",
        billingCycle: .monthly,
        nextRenewalDate: nil,
        signupChannel: nil,
        status: .active,
        importance: 4,
        cancellationUrl: nil,
        notes: nil,
        matchedServiceId: "synthetic-catalog-cloud",
        usageType: "capacity",
        initialValueAnswer: nil,
        planCapacityGb: 200,
        usedCapacityGb: 82,
        capacityCheckedAt: "2026-07-16T00:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-07-16T09:38:00.000Z"
    )

    static let videoReview = Recommendation(
        id: "synthetic-review",
        subscriptionId: video.id,
        decision: .considerDowngrade,
        dataStatus: .ready,
        observationDays: 45,
        daysUntilReady: 0,
        monthlyAmount: 1_000,
        yearlyAmount: 12_000,
        usageDays30d: 2,
        usageMinutes30d: 35,
        daysSinceLastUse: 18,
        daysUntilRenewal: 5,
        costPerUsageDay: 500,
        hasOverlap: false,
        confidence: 0.72,
        reason: "更新が近く、利用頻度に対して安いプランを確認できる可能性があります。",
        matchedPatterns: [
            MatchedPattern(label: "更新が近い", detail: "5日後に更新予定です"),
            MatchedPattern(label: "安いプランがある", detail: "料金条件を公式サイトで確認してください")
        ],
        generatedAt: "2026-07-16T09:38:00.000Z"
    )

    static let populated = ProductPreviewSnapshot(
        subscriptions: [video, cloud],
        recommendations: [videoReview],
        upcomingRenewals: [
            UpcomingRenewal(
                id: video.id,
                name: video.name,
                amount: video.amount,
                currency: "JPY",
                billingCycle: .monthly,
                nextRenewalDate: video.nextRenewalDate,
                daysUntilRenewal: 5
            )
        ],
        dashboard: DashboardSummary(
            activeCount: 2,
            totalCount: 2,
            monthlyTotal: 1_400,
            yearlyTotal: 16_800,
            currency: "JPY"
        ),
        spending: SpendingSummary(
            monthlyTotal: 1_400,
            yearlyTotal: 16_800,
            activeCount: 2,
            byCategory: [
                CategorySpending(category: "video_streaming", monthly: 1_000, share: 0.714),
                CategorySpending(category: "cloud_storage", monthly: 400, share: 0.286)
            ],
            monthlyTrend: [
                MonthlySpending(month: "2026-02", monthly: 0),
                MonthlySpending(month: "2026-03", monthly: 0),
                MonthlySpending(month: "2026-04", monthly: 0),
                MonthlySpending(month: "2026-05", monthly: 400),
                MonthlySpending(month: "2026-06", monthly: 1_400),
                MonthlySpending(month: "2026-07", monthly: 1_400)
            ]
        )
    )

    static let empty = ProductPreviewSnapshot(
        subscriptions: [],
        recommendations: [],
        upcomingRenewals: [],
        dashboard: DashboardSummary(activeCount: 0, totalCount: 0, monthlyTotal: 0, yearlyTotal: 0, currency: "JPY"),
        spending: SpendingSummary(monthlyTotal: 0, yearlyTotal: 0, activeCount: 0, byCategory: [], monthlyTrend: [])
    )

    static let failure = ProductPreviewSnapshot(
        subscriptions: [video, cloud],
        recommendations: [videoReview],
        upcomingRenewals: [],
        dashboard: nil,
        spending: nil,
        errorMessage: "通信できませんでした。入力内容はそのままにして、もう一度お試しください。"
    )

    static let twoHundredSubscriptions: [Subscription] = (1...200).map { index in
        let number = String(format: "%03d", index)
        return Subscription(
            id: "synthetic-load-\(number)",
            name: "合成契約 \(number)",
            normalizedName: "synthetic-load-\(number)",
            category: index.isMultiple(of: 2) ? "video_streaming" : "cloud_storage",
            amount: 500 + (index * 10),
            currency: "JPY",
            billingCycle: .monthly,
            nextRenewalDate: "2026-08-15T00:00:00.000Z",
            signupChannel: "合成負荷確認",
            status: .active,
            importance: (index % 5) + 1,
            cancellationUrl: "https://example.invalid/synthetic/\(number)",
            notes: "合成データ",
            matchedServiceId: nil,
            usageType: "active_foreground",
            initialValueAnswer: nil,
            planCapacityGb: nil,
            usedCapacityGb: nil,
            capacityCheckedAt: nil,
            createdAt: "2026-07-17T00:00:00.000Z",
            updatedAt: "2026-07-17T00:00:00.000Z"
        )
    }

    static let twoHundred = ProductPreviewSnapshot(
        subscriptions: twoHundredSubscriptions,
        recommendations: [],
        upcomingRenewals: [],
        dashboard: DashboardSummary(
            activeCount: twoHundredSubscriptions.count,
            totalCount: twoHundredSubscriptions.count,
            monthlyTotal: twoHundredSubscriptions.reduce(0) { $0 + $1.monthlyAmount },
            yearlyTotal: twoHundredSubscriptions.reduce(0) { $0 + $1.yearlyAmount },
            currency: "JPY"
        ),
        spending: nil
    )
}

#Preview("ホーム・通常") {
    NavigationStack {
        HomeView(authSession: AuthSession(), store: ProductStore(previewSnapshot: PreviewFixtures.populated))
    }
}

#Preview("ホーム・空") {
    NavigationStack {
        HomeView(authSession: AuthSession(), store: ProductStore(previewSnapshot: PreviewFixtures.empty))
    }
}

#Preview("ホーム・通信失敗") {
    NavigationStack {
        HomeView(authSession: AuthSession(), store: ProductStore(previewSnapshot: PreviewFixtures.failure))
    }
}

#Preview("契約詳細・最大文字") {
    NavigationStack {
        SubscriptionDetailView(
            store: ProductStore(previewSnapshot: PreviewFixtures.populated),
            subscriptionID: PreviewFixtures.cloud.id
        )
    }
    .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("見直し詳細") {
    NavigationStack {
        ReviewDetailView(subscription: PreviewFixtures.video, recommendation: PreviewFixtures.videoReview)
    }
}

#Preview("契約一覧・合成200件") {
    NavigationStack {
        SubscriptionListView(store: ProductStore(previewSnapshot: PreviewFixtures.twoHundred))
    }
}
