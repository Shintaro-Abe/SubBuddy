import FamilyControls
import Foundation

struct SubscriptionMapping: Codable {
    let subscriptionId: String
    let activityName: String
    let selection: Data
}

final class MappingStore {
    private let defaults: UserDefaults?
    private let key = "subscription_mappings"

    init() {
        defaults = UserDefaults(suiteName: AppConstants.appGroupID)
    }

    func save(_ mapping: SubscriptionMapping) {
        guard let defaults else { return }

        var all = loadAll()
        all.removeAll { $0.subscriptionId == mapping.subscriptionId }
        all.append(mapping)

        if let data = try? JSONEncoder().encode(all) {
            defaults.set(data, forKey: key)
        }
    }

    func loadAll() -> [SubscriptionMapping] {
        guard let defaults, let data = defaults.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([SubscriptionMapping].self, from: data)) ?? []
    }

    func activityName(for subscriptionId: String) -> String {
        "sub_\(subscriptionId)"
    }

    func subscriptionId(for activityName: String) -> String? {
        loadAll().first { $0.activityName == activityName }?.subscriptionId
    }
}
