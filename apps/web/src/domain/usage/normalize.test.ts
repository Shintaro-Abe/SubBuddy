import { describe, expect, it } from "vitest";
import { UsageBucket } from "@prisma/client";
import { normalizeUsageBatch, normalizeUsageDaily } from "./normalize";
import { usageDailyItemSchema } from "@/schemas/usage";

describe("normalizeUsageDaily", () => {
  it("ワイヤ形式バケットを Prisma enum に変換し日付を UTC0時に固定", () => {
    const item = usageDailyItemSchema.parse({
      subscriptionId: "sub_1",
      date: "2026-05-30",
      used: true,
      usageBucket: "30m_plus",
    });
    const n = normalizeUsageDaily(item);
    expect(n.usageBucket).toBe(UsageBucket.m30_plus);
    expect(n.usageDate.toISOString()).toBe("2026-05-30T00:00:00.000Z");
    expect(n.source).toBe("ios_device_activity");
    expect(n.estimatedMinutesMin).toBeNull();
  });

  it("バッチをまとめて整形する", () => {
    const items = [
      usageDailyItemSchema.parse({
        subscriptionId: "sub_1",
        date: "2026-05-30",
        used: false,
        usageBucket: "none",
      }),
      usageDailyItemSchema.parse({
        subscriptionId: "sub_2",
        date: "2026-05-31",
        used: true,
        usageBucket: "1m_plus",
      }),
    ];
    const out = normalizeUsageBatch(items);
    expect(out).toHaveLength(2);
    expect(out[1].usageBucket).toBe(UsageBucket.m1_plus);
  });
});
