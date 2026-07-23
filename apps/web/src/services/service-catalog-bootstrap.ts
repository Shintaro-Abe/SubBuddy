import type { Prisma, PrismaClient } from "@prisma/client";
import catalogEntries from "../../prisma/seed/service-catalog.json";

type CatalogDb = Pick<PrismaClient, "$transaction">;
type CatalogTransaction = Pick<
  Prisma.TransactionClient,
  "serviceCatalog" | "servicePlan" | "serviceAlternative"
>;

type CatalogEntry = {
  canonicalName: string;
  category: string;
  usageType: string;
  commonAliases: string;
  plans: Array<{
    name: string;
    monthlyPrice: number;
    isFreeTier: boolean;
    capacityGb?: number;
    verifiedAt?: string;
    sourceUrl?: string;
  }>;
  alternatives: string[];
};

const managedCatalog: CatalogEntry[] = catalogEntries;

const excludedAppleServices = [
  { canonicalName: "Apple Music", category: "music", commonAliases: "アップルミュージック" },
  { canonicalName: "Apple TV+", category: "video_streaming" },
  { canonicalName: "Apple Arcade", category: "game" },
  { canonicalName: "Apple One", category: "bundle" },
] as const;

export type ServiceCatalogSyncResult = {
  catalog: number;
  plans: number;
  alternatives: number;
};

/**
 * 配布環境向けの参照カタログ同期。
 * 利用者、契約、利用実績には触れず、管理対象のカタログだけを冪等に更新する。
 */
export async function syncServiceCatalog(
  db: CatalogDb,
): Promise<ServiceCatalogSyncResult> {
  return db.$transaction(async (tx) => syncCatalogInTransaction(tx));
}

async function syncCatalogInTransaction(
  tx: CatalogTransaction,
): Promise<ServiceCatalogSyncResult> {
  const serviceIdByName = new Map<string, string>();

  for (const entry of excludedAppleServices) {
    const id = await upsertService(tx, {
      canonicalName: entry.canonicalName,
      category: entry.category,
      commonAliases: "commonAliases" in entry ? entry.commonAliases : null,
      usageType: "active_foreground",
      isSupported: true,
      isExcluded: true,
    });
    serviceIdByName.set(entry.canonicalName, id);
  }

  for (const entry of managedCatalog) {
    const id = await upsertService(tx, {
      canonicalName: entry.canonicalName,
      category: entry.category,
      commonAliases: entry.commonAliases,
      usageType: entry.usageType,
      isSupported: true,
      isExcluded: false,
    });
    serviceIdByName.set(entry.canonicalName, id);
  }

  let planCount = 0;
  for (const entry of managedCatalog) {
    const serviceId = serviceIdByName.get(entry.canonicalName);
    if (!serviceId) throw new Error(`Managed catalog ID is missing: ${entry.canonicalName}`);

    await tx.servicePlan.deleteMany({ where: { serviceId } });
    if (entry.plans.length > 0) {
      await tx.servicePlan.createMany({
        data: entry.plans.map((plan) => ({
          serviceId,
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          isFreeTier: plan.isFreeTier,
          capacityGb: plan.capacityGb ?? null,
          // 確認日は配備日ではない。カタログ資材に明記した公式確認日だけを使う。
          verifiedAt: new Date(plan.verifiedAt ?? "1970-01-01T00:00:00.000Z"),
          sourceUrl: plan.sourceUrl ?? null,
        })),
      });
      planCount += entry.plans.length;
    }
  }

  const managedIds = [...serviceIdByName.values()];
  await tx.serviceAlternative.deleteMany({ where: { fromServiceId: { in: managedIds } } });

  const alternatives = managedCatalog.flatMap((entry) => {
    const fromServiceId = serviceIdByName.get(entry.canonicalName);
    if (!fromServiceId) return [];
    return entry.alternatives.flatMap((alternativeName) => {
      const toServiceId = serviceIdByName.get(alternativeName);
      // 代替関係は出典と確認日を別途持つまで見直し根拠へ使わない。
      return toServiceId
        ? [{ fromServiceId, toServiceId, verifiedAt: null, sourceUrl: null }]
        : [];
    });
  });
  if (alternatives.length > 0) {
    await tx.serviceAlternative.createMany({ data: alternatives });
  }

  return {
    catalog: serviceIdByName.size,
    plans: planCount,
    alternatives: alternatives.length,
  };
}

async function upsertService(
  tx: CatalogTransaction,
  data: {
    canonicalName: string;
    category: string;
    commonAliases: string | null;
    usageType: string;
    isSupported: boolean;
    isExcluded: boolean;
  },
): Promise<string> {
  const existing = await tx.serviceCatalog.findFirst({
    where: { canonicalName: data.canonicalName },
    select: { id: true },
  });
  if (existing) {
    await tx.serviceCatalog.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  const created = await tx.serviceCatalog.create({ data, select: { id: true } });
  return created.id;
}
