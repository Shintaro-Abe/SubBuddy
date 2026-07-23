import { describe, expect, it, vi } from "vitest";
import { syncServiceCatalog } from "./service-catalog-bootstrap";

function fakeCatalogDb() {
  const catalog = new Map<string, { id: string; data: Record<string, unknown> }>();
  const plans = new Map<string, Array<Record<string, unknown>>>();
  let alternatives: Array<Record<string, unknown>> = [];

  const tx = {
    serviceCatalog: {
      findFirst: vi.fn(async ({ where }: { where: { canonicalName: string } }) => {
        const item = catalog.get(where.canonicalName);
        return item ? { id: item.id } : null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const item = [...catalog.entries()].find(([, value]) => value.id === where.id);
          if (item) catalog.set(item[0], { id: where.id, data });
          return { id: where.id };
        },
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const canonicalName = String(data.canonicalName);
        const id = `synthetic_catalog_${catalog.size + 1}`;
        catalog.set(canonicalName, { id, data });
        return { id };
      }),
    },
    servicePlan: {
      deleteMany: vi.fn(async ({ where }: { where: { serviceId: string } }) => {
        plans.delete(where.serviceId);
        return { count: 0 };
      }),
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        const serviceId = String(data[0]?.serviceId);
        plans.set(serviceId, data);
        return { count: data.length };
      }),
    },
    serviceAlternative: {
      deleteMany: vi.fn(async () => {
        alternatives = [];
        return { count: 0 };
      }),
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        alternatives = data;
        return { count: data.length };
      }),
    },
  };
  const db = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  return {
    db,
    tx,
    snapshot: () => ({
      catalog: [...catalog.entries()],
      plans: [...plans.entries()],
      alternatives: [...alternatives],
    }),
  };
}

describe("syncServiceCatalog", () => {
  it("利用者データに触れずiCloud+と容量プランを同期する", async () => {
    const { db, snapshot } = fakeCatalogDb();
    const result = await syncServiceCatalog(db as never);
    const state = snapshot();
    const iCloud = state.catalog.find(([name]) => name === "iCloud+");

    expect(result.catalog).toBeGreaterThan(4);
    expect(iCloud?.[1].data).toMatchObject({
      category: "cloud_storage",
      usageType: "capacity",
      isExcluded: false,
    });
    const iCloudPlans = state.plans.find(([serviceId]) => serviceId === iCloud?.[1].id)?.[1];
    expect(iCloudPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "200GB", monthlyPrice: 450, capacityGb: 200 }),
      ]),
    );
  });

  it("2回実行してもカタログ・プラン・代替関係が重複しない", async () => {
    const { db, snapshot } = fakeCatalogDb();
    const first = await syncServiceCatalog(db as never);
    const firstState = snapshot();
    const second = await syncServiceCatalog(db as never);
    const secondState = snapshot();

    expect(second).toEqual(first);
    expect(secondState.catalog).toHaveLength(firstState.catalog.length);
    expect(secondState.plans).toEqual(firstState.plans);
    expect(secondState.alternatives).toEqual(firstState.alternatives);
  });

  it("出典のないプランを配備日で確認済みにしない", async () => {
    const { db, snapshot } = fakeCatalogDb();
    await syncServiceCatalog(db as never);
    const state = snapshot();
    const netflix = state.catalog.find(([name]) => name === "Netflix");
    const plans = state.plans.find(([serviceId]) => serviceId === netflix?.[1].id)?.[1] ?? [];

    expect(plans[0]).toMatchObject({
      sourceUrl: null,
      verifiedAt: new Date("1970-01-01T00:00:00.000Z"),
    });
  });
});
