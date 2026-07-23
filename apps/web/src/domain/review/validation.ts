import type { RecommendationSnapshot, Subscription } from "@prisma/client";
import { defaultScoringConfig, type ScoringConfig } from "@/config/scoring";
import { toMonthlyAmount, toYearlyAmount } from "@/lib/money";
import { parseMatchedPatterns } from "@/domain/scoring/matchedPatterns";
import { parseReviewOptions, parseReviewUnknowns } from "./output";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewValidationCode =
  | "legacy_output"
  | "owner_mismatch"
  | "subscription_changed"
  | "fact_mismatch"
  | "catalog_stale"
  | "usage_only_priority"
  | "missing_unknown"
  | "unsafe_source"
  | "savings_mismatch";

export type ReviewValidationResult =
  | { ok: true }
  | { ok: false; code: ReviewValidationCode };

export function validateReviewForDisplay(
  userId: string,
  snapshot: RecommendationSnapshot,
  subscription: Pick<
    Subscription,
    "id" | "userId" | "amount" | "billingCycle" | "updatedAt"
  >,
  asOf: Date = new Date(),
  config: ScoringConfig = defaultScoringConfig,
): ReviewValidationResult {
  if (snapshot.userId !== userId || subscription.userId !== userId) {
    return blocked("owner_mismatch");
  }
  if (snapshot.subscriptionId !== subscription.id) return blocked("owner_mismatch");
  if (
    snapshot.reviewPriority === null ||
    snapshot.sourceSubscriptionUpdatedAt === null
  ) {
    return blocked("legacy_output");
  }
  if (
    snapshot.sourceSubscriptionUpdatedAt.getTime() !== subscription.updatedAt.getTime()
  ) {
    return blocked("subscription_changed");
  }

  const monthlyAmount = toMonthlyAmount(subscription.amount, subscription.billingCycle);
  const yearlyAmount = toYearlyAmount(subscription.amount, subscription.billingCycle);
  if (
    snapshot.monthlyAmount !== monthlyAmount ||
    snapshot.yearlyAmount !== yearlyAmount ||
    snapshot.annualSavingsIfCancelled !== yearlyAmount
  ) {
    return blocked("fact_mismatch");
  }

  if (hasUnsafeSource(snapshot.reviewOptions)) return blocked("unsafe_source");

  const unknowns = parseReviewUnknowns(snapshot.reviewUnknowns);
  const options = parseReviewOptions(snapshot.reviewOptions);
  if (!unknowns || !options) return blocked("legacy_output");

  const patterns = parseMatchedPatterns(snapshot.matchedPatterns);
  const nonUsagePatterns = patterns.filter((pattern) => pattern.pattern !== "P1");
  if (
    (snapshot.reviewPriority === "now" ||
      snapshot.reviewPriority === "before_renewal") &&
    patterns.some((pattern) => pattern.pattern === "P1") &&
    nonUsagePatterns.length === 0
  ) {
    return blocked("usage_only_priority");
  }

  if (
    snapshot.dataStatus === "observing" &&
    !unknowns.some((unknown) => unknown.code === "observation_incomplete")
  ) {
    return blocked("missing_unknown");
  }
  if (
    patterns.some((pattern) => pattern.pattern === "P1") &&
    !unknowns.some((unknown) => unknown.code === "usage_scope")
  ) {
    return blocked("missing_unknown");
  }
  if (
    patterns.some(
      (pattern) => pattern.pattern === "P3" && pattern.status === "needs_capacity_check",
    ) &&
    !unknowns.some(
      (unknown) =>
        unknown.code === "capacity_missing" || unknown.code === "capacity_stale",
    )
  ) {
    return blocked("missing_unknown");
  }

  for (const option of options) {
    if (option.kind !== "downgrade" && option.kind !== "switch") continue;
    if (!option.sourceUrl || !option.verifiedAt || !isSafeHttpUrl(option.sourceUrl)) {
      return blocked("unsafe_source");
    }
    const verifiedAt = new Date(option.verifiedAt);
    const ageDays = Math.floor((asOf.getTime() - verifiedAt.getTime()) / DAY_MS);
    if (
      Number.isNaN(verifiedAt.getTime()) ||
      ageDays < 0 ||
      ageDays > config.knowledgeBaseFreshnessDays
    ) {
      return blocked("catalog_stale");
    }
    if (
      option.currentMonthlyAmount === undefined ||
      option.targetMonthlyAmount === undefined ||
      option.annualSavings === undefined
    ) {
      return blocked("savings_mismatch");
    }
    const expected = Math.max(
      0,
      (option.currentMonthlyAmount - option.targetMonthlyAmount) * 12,
    );
    if (
      option.currentMonthlyAmount !== monthlyAmount ||
      option.annualSavings !== expected
    ) {
      return blocked("savings_mismatch");
    }
    if (
      option.kind === "downgrade" &&
      snapshot.annualSavingsIfDowngraded !== expected
    ) {
      return blocked("savings_mismatch");
    }
    if (
      option.kind === "switch" &&
      snapshot.annualSavingsIfSwitched !== expected
    ) {
      return blocked("savings_mismatch");
    }
  }

  return { ok: true };
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function hasUnsafeSource(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((option) => {
    if (typeof option !== "object" || option === null || !("sourceUrl" in option)) {
      return false;
    }
    const sourceUrl = option.sourceUrl;
    return typeof sourceUrl !== "string" || !isSafeHttpUrl(sourceUrl);
  });
}

function blocked(code: ReviewValidationCode): ReviewValidationResult {
  return { ok: false, code };
}
