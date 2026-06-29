import { z } from "zod";
import { USAGE_BUCKET_WIRE } from "@/lib/usage-bucket";

/**
 * 利用量同期 API（POST /api/usage/daily）の入力検証（functional-design §10.1）。
 * iOS からの「集計値のみ」を受ける。詳細ログは受け付けない。
 * subscriptionId × date で冪等 upsert する前提。
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const USAGE_BATCH_MAX_ITEMS = 1000;

export const usageDailyItemSchema = z
  .object({
    subscriptionId: z.string().trim().min(1),
    date: z.string().regex(ISO_DATE),
    used: z.boolean(),
    usageBucket: z.enum(USAGE_BUCKET_WIRE),
    estimatedMinutesMin: z.number().int().min(0).optional(),
    estimatedMinutesMax: z.number().int().min(0).optional(),
    source: z.enum(["ios_device_activity", "manual_synthetic", "ios_shortcut"]).default("ios_device_activity"),
  })
  .refine(
    (v) =>
      v.estimatedMinutesMin === undefined ||
      v.estimatedMinutesMax === undefined ||
      v.estimatedMinutesMax >= v.estimatedMinutesMin,
    {
      message: "estimatedMinutesMax must be >= estimatedMinutesMin",
      path: ["estimatedMinutesMax"],
    },
  );

export const usageDailyBatchSchema = z.object({
  items: z.array(usageDailyItemSchema).min(1).max(USAGE_BATCH_MAX_ITEMS),
});

export type UsageDailyItemInput = z.infer<typeof usageDailyItemSchema>;
export type UsageDailyBatchInput = z.infer<typeof usageDailyBatchSchema>;
