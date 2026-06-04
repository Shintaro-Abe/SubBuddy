import { z } from "zod";

/**
 * サブスク登録/更新の入力検証（development-guidelines §2「入力は信頼しない」）。
 * 金額は最小通貨単位の整数。日付は YYYY-MM-DD のワイヤ形式で受ける。
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const billingCycleSchema = z.enum(["monthly", "yearly"]);
export const subscriptionStatusSchema = z.enum(["active", "paused", "canceled"]);

export const subscriptionCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  amount: z.number().int().min(0), // 最小通貨単位の整数
  currency: z.string().trim().length(3).default("JPY"),
  billingCycle: billingCycleSchema,
  nextRenewalDate: z.string().regex(ISO_DATE).optional(),
  importance: z.number().int().min(1).max(5).default(3),
  cancellationUrl: z.string().url().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  signupChannel: z.string().max(100).optional(),
  status: subscriptionStatusSchema.default("active"),
});

// 更新は全項目任意（部分更新）。
export const subscriptionUpdateSchema = subscriptionCreateSchema.partial();

export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
