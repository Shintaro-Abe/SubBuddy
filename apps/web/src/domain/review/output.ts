import { z } from "zod";

export const REVIEW_PRIORITIES = [
  "now",
  "before_renewal",
  "missing_information",
  "low_urgency",
] as const;

export type ReviewPriorityValue = (typeof REVIEW_PRIORITIES)[number];

export const REVIEW_PRIORITY_LABEL: Record<ReviewPriorityValue, string> = {
  now: "今確認したい",
  before_renewal: "更新前に確認したい",
  missing_information: "情報が不足している",
  low_urgency: "現時点では急いで確認する材料が少ない",
};

export const reviewUnknownSchema = z.object({
  code: z.enum([
    "usage_scope",
    "observation_incomplete",
    "capacity_missing",
    "capacity_stale",
    "catalog_stale",
  ]),
  message: z.string().min(1),
});

export const reviewOptionSchema = z.object({
  kind: z.enum([
    "continue",
    "check_usage",
    "check_overlap",
    "check_plan",
    "downgrade",
    "switch",
    "check_cancellation",
  ]),
  title: z.string().min(1),
  detail: z.string().min(1),
  targetName: z.string().min(1).optional(),
  currentMonthlyAmount: z.number().int().min(0).optional(),
  targetMonthlyAmount: z.number().int().min(0).optional(),
  annualSavings: z.number().int().min(0).optional(),
  calculation: z.string().min(1).optional(),
  sourceUrl: z.string().url().refine((value) => /^https?:\/\//i.test(value)).optional(),
  verifiedAt: z.string().datetime().optional(),
});

export type ReviewUnknown = z.infer<typeof reviewUnknownSchema>;
export type ReviewOption = z.infer<typeof reviewOptionSchema>;

export const reviewUnknownsSchema = z.array(reviewUnknownSchema);
export const reviewOptionsSchema = z.array(reviewOptionSchema);

export function parseReviewUnknowns(value: unknown): ReviewUnknown[] | null {
  const parsed = reviewUnknownsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseReviewOptions(value: unknown): ReviewOption[] | null {
  const parsed = reviewOptionsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
