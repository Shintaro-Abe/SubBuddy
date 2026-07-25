import { describe, expect, it } from "vitest";
import { isSupportedTimeZone, isWithinDeliveryHours, nextDeliveryWindowStart } from "./time-zone";

describe("通知配信時間", () => {
  it("IANAタイムゾーンだけを受け付ける", () => {
    expect(isSupportedTimeZone("Asia/Tokyo")).toBe(true);
    expect(isSupportedTimeZone("America/Los_Angeles")).toBe(true);
    expect(isSupportedTimeZone("not-a-time-zone")).toBe(false);
  });

  it("東京の9時以上20時未満を配信可能とする", () => {
    expect(isWithinDeliveryHours(new Date("2026-07-25T00:00:00.000Z"), "Asia/Tokyo", 9, 20)).toBe(
      true,
    );
    expect(isWithinDeliveryHours(new Date("2026-07-25T10:59:59.000Z"), "Asia/Tokyo", 9, 20)).toBe(
      true,
    );
    expect(isWithinDeliveryHours(new Date("2026-07-25T11:00:00.000Z"), "Asia/Tokyo", 9, 20)).toBe(
      false,
    );
  });

  it("時間外なら夏時間を含む端末現地の次の9時へ繰り下げる", () => {
    expect(
      nextDeliveryWindowStart(
        new Date("2026-03-08T07:30:00.000Z"),
        "America/Los_Angeles",
        9,
        20,
      ).toISOString(),
    ).toBe("2026-03-08T16:00:00.000Z");
  });
});
