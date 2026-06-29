import { describe, expect, it } from "vitest";
import { usageDailyBatchSchema, usageDailyItemSchema, USAGE_BATCH_MAX_ITEMS } from "./usage";

const validItem = {
  subscriptionId: "sub_1",
  date: "2026-05-30",
  used: true,
  usageBucket: "30m_plus" as const,
};

describe("usageDailyItemSchema", () => {
  it("最小構成を受理し source の既定値を補う", () => {
    const r = usageDailyItemSchema.parse(validItem);
    expect(r.source).toBe("ios_device_activity");
  });

  it("usageBucket の列挙外を拒否", () => {
    expect(usageDailyItemSchema.safeParse({ ...validItem, usageBucket: "45m_plus" }).success).toBe(
      false,
    );
  });

  it("date は YYYY-MM-DD 以外を拒否", () => {
    expect(usageDailyItemSchema.safeParse({ ...validItem, date: "May 30" }).success).toBe(false);
  });

  it("estimatedMinutesMax < min を拒否", () => {
    expect(
      usageDailyItemSchema.safeParse({
        ...validItem,
        estimatedMinutesMin: 30,
        estimatedMinutesMax: 10,
      }).success,
    ).toBe(false);
    expect(
      usageDailyItemSchema.safeParse({
        ...validItem,
        estimatedMinutesMin: 30,
        estimatedMinutesMax: 59,
      }).success,
    ).toBe(true);
  });
});

describe("usageDailyBatchSchema", () => {
  it("空配列を拒否", () => {
    expect(usageDailyBatchSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("正常なバッチを受理", () => {
    expect(usageDailyBatchSchema.safeParse({ items: [validItem] }).success).toBe(true);
  });

  it("上限件数を超えると拒否", () => {
    const items = Array.from({ length: USAGE_BATCH_MAX_ITEMS + 1 }, (_, i) => ({
      ...validItem,
      subscriptionId: `sub_${i}`,
    }));
    expect(usageDailyBatchSchema.safeParse({ items }).success).toBe(false);
  });
});
