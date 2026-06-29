import { describe, expect, it } from "vitest";
import { subscriptionCreateSchema, subscriptionUpdateSchema } from "./subscription";

describe("subscriptionCreateSchema", () => {
  const valid = {
    name: "Amazon Music",
    category: "music",
    amount: 1080,
    billingCycle: "monthly" as const,
  };

  it("最小構成を受理し、既定値を補う", () => {
    const r = subscriptionCreateSchema.parse(valid);
    expect(r.currency).toBe("JPY");
    expect(r.importance).toBe(3);
    expect(r.status).toBe("active");
  });

  it("金額は非負整数のみ（負数・小数を拒否）", () => {
    expect(subscriptionCreateSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false);
    expect(subscriptionCreateSchema.safeParse({ ...valid, amount: 9.9 }).success).toBe(false);
  });

  it("importance は 1..5 の範囲外を拒否", () => {
    expect(subscriptionCreateSchema.safeParse({ ...valid, importance: 0 }).success).toBe(false);
    expect(subscriptionCreateSchema.safeParse({ ...valid, importance: 6 }).success).toBe(false);
  });

  it("billingCycle は列挙外を拒否", () => {
    expect(subscriptionCreateSchema.safeParse({ ...valid, billingCycle: "weekly" }).success).toBe(
      false,
    );
  });

  it("nextRenewalDate は YYYY-MM-DD 以外を拒否", () => {
    expect(
      subscriptionCreateSchema.safeParse({ ...valid, nextRenewalDate: "2026/06/01" }).success,
    ).toBe(false);
    expect(
      subscriptionCreateSchema.safeParse({ ...valid, nextRenewalDate: "2026-06-01" }).success,
    ).toBe(true);
  });

  it("空名称を拒否", () => {
    expect(subscriptionCreateSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("update は部分更新を許可", () => {
    expect(subscriptionUpdateSchema.safeParse({}).success).toBe(true);
    expect(subscriptionUpdateSchema.safeParse({ amount: 500 }).success).toBe(true);
  });
});
