import { describe, expect, it } from "vitest";
import { guidanceEventSchema } from "@/schemas/guidance-progress";

describe("guidanceEventSchema", () => {
  it.each([
    "inventory_completed",
    "spending_viewed",
    "review_viewed",
    "measurement_configured",
    "measurement_skipped",
    "measurement_reset",
  ])("固定イベント %s を受け付ける", (event) => {
    expect(guidanceEventSchema.parse({ event })).toEqual({ event });
  });

  it("任意の進捗値や利用者IDを受け付けない", () => {
    expect(() =>
      guidanceEventSchema.parse({
        event: "review_viewed",
        userId: "synthetic-other-user",
        contractName: "合成契約",
      }),
    ).toThrow();
    expect(() => guidanceEventSchema.parse({ event: "force_complete" })).toThrow();
  });
});
