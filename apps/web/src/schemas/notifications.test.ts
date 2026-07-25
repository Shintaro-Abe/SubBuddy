import { describe, expect, it } from "vitest";
import { pushTokenSchema } from "./notifications";

const baseRequest = {
  token: "AABBCCDDEEFF00112233445566778899",
  environment: "sandbox",
  deliveryEnabled: true,
};

describe("通知API入力", () => {
  it("IANAタイムゾーンを受け付ける", () => {
    expect(pushTokenSchema.safeParse({ ...baseRequest, timeZone: "Asia/Tokyo" }).success).toBe(
      true,
    );
  });

  it("更新前のiPhoneとの互換性のためタイムゾーンなしも受け付ける", () => {
    expect(pushTokenSchema.safeParse(baseRequest).success).toBe(true);
  });

  it("存在しないタイムゾーンは拒否する", () => {
    expect(pushTokenSchema.safeParse({ ...baseRequest, timeZone: "not-a-time-zone" }).success).toBe(
      false,
    );
  });
});
