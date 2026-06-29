import { describe, expect, it } from "vitest";
import { toMonthlyAmount, toYearlyAmount } from "./money";

describe("money", () => {
  it("monthly はそのまま月額", () => {
    expect(toMonthlyAmount(1080, "monthly")).toBe(1080);
  });

  it("yearly は 12 で割って月額換算（四捨五入）", () => {
    expect(toMonthlyAmount(12000, "yearly")).toBe(1000);
    expect(toMonthlyAmount(4277, "yearly")).toBe(356);
  });

  it("yearly 換算は monthly を 12 倍", () => {
    expect(toYearlyAmount(1000, "monthly")).toBe(12000);
    expect(toYearlyAmount(12000, "yearly")).toBe(12000);
  });

  it("負数・非整数は拒否する", () => {
    expect(() => toMonthlyAmount(-1, "monthly")).toThrow();
    expect(() => toMonthlyAmount(9.9, "monthly")).toThrow();
  });
});
