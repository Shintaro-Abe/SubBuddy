import { describe, expect, it } from "vitest";
import { isoDate, upcomingRenewalDate } from "./renewal";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("upcomingRenewalDate", () => {
  it("未来の入力日はそのまま返す", () => {
    expect(isoDate(upcomingRenewalDate(date("2026-08-15"), "monthly", date("2026-07-23")))).toBe(
      "2026-08-15",
    );
  });

  it("月末基準は各月末へ進める", () => {
    expect(isoDate(upcomingRenewalDate(date("2026-01-31"), "monthly", date("2026-02-01")))).toBe(
      "2026-02-28",
    );
    expect(isoDate(upcomingRenewalDate(date("2026-01-31"), "monthly", date("2026-03-01")))).toBe(
      "2026-03-31",
    );
  });

  it("月末でない日は可能な限り同じ日へ進める", () => {
    expect(isoDate(upcomingRenewalDate(date("2026-01-30"), "monthly", date("2026-02-01")))).toBe(
      "2026-02-28",
    );
    expect(isoDate(upcomingRenewalDate(date("2026-01-30"), "monthly", date("2026-03-01")))).toBe(
      "2026-03-30",
    );
  });

  it("閏日の年額契約は平年の2月末へ進める", () => {
    expect(isoDate(upcomingRenewalDate(date("2024-02-29"), "yearly", date("2025-01-01")))).toBe(
      "2025-02-28",
    );
  });
});
