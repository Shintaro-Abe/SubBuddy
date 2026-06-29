import Foundation
import FamilyControls
import ManagedSettings

/// サブスク ID ⇄ FamilyActivitySelection の対応表。
/// iPhone ローカル限定で保持し、Mac へは送らない（design.md §4.2）。
struct SubscriptionMapping: Codable {
    let subscriptionId: String
    let activityName: String  // "sub_<subscriptionId>"
    let selection: Data       // FamilyActivitySelection を Codable でシリアライズ
}

final class MappingStore {
    private let defaults: UserDefaults?

    init() {
        defaults = UserDefaults(suiteName: SpikeConstants.appGroupID)
    }

    private let key = "subscription_mappings"

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
