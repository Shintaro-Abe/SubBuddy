import type { GuidanceMeasurementChoice } from "@prisma/client";
import {
  countUserSubscriptions,
  getGuidanceProgressRecord,
  type GuidanceProgressRecord,
  upsertGuidanceProgressRecord,
} from "@/repositories/guidance-progress";
import type { GuidanceEvent } from "@/schemas/guidance-progress";

export type GuidanceStepKey = "inventory" | "spending" | "review" | "measurement";

export type ResolvedGuidanceProgress = {
  steps: Record<GuidanceStepKey, boolean>;
  completedCount: number;
  totalCount: 4;
  nextStep: GuidanceStepKey | null;
  isComplete: boolean;
  measurementChoice: GuidanceMeasurementChoice;
};

const EMPTY: GuidanceProgressRecord = {
  inventoryCompletedAt: null,
  spendingViewedAt: null,
  reviewViewedAt: null,
  measurementChoice: "pending",
  completedAt: null,
};

export function resolveGuidanceProgress(
  subscriptionCount: number,
  record: GuidanceProgressRecord | null,
): ResolvedGuidanceProgress {
  const current = record ?? EMPTY;
  const steps = {
    inventory: subscriptionCount > 0 && current.inventoryCompletedAt !== null,
    spending: current.spendingViewedAt !== null,
    review: current.reviewViewedAt !== null,
    measurement: current.measurementChoice !== "pending",
  };
  const order: GuidanceStepKey[] = ["inventory", "spending", "review", "measurement"];
  const nextStep = order.find((step) => !steps[step]) ?? null;
  const completedCount = order.filter((step) => steps[step]).length;
  return {
    steps,
    completedCount,
    totalCount: 4,
    nextStep,
    isComplete: completedCount === 4,
    measurementChoice: current.measurementChoice,
  };
}

export async function getResolvedGuidanceProgress(
  userId: string,
): Promise<ResolvedGuidanceProgress> {
  const [subscriptionCount, record] = await Promise.all([
    countUserSubscriptions(userId),
    getGuidanceProgressRecord(userId),
  ]);
  return resolveGuidanceProgress(subscriptionCount, record);
}

export async function recordGuidanceEvent(
  userId: string,
  event: GuidanceEvent,
  now = new Date(),
): Promise<ResolvedGuidanceProgress> {
  const current = await getGuidanceProgressRecord(userId);
  const create = {
    userId,
    inventoryCompletedAt: event === "inventory_completed" ? now : null,
    spendingViewedAt: event === "spending_viewed" ? now : null,
    reviewViewedAt: event === "review_viewed" ? now : null,
    measurementChoice: measurementChoiceFor(event),
  } as const;
  const update = updateFor(event, current, now);
  await upsertGuidanceProgressRecord(userId, update, create);

  const resolved = await getResolvedGuidanceProgress(userId);
  if (resolved.isComplete && current?.completedAt === null) {
    await upsertGuidanceProgressRecord(userId, { completedAt: now }, create);
  }
  return resolved;
}

function measurementChoiceFor(event: GuidanceEvent): GuidanceMeasurementChoice {
  if (event === "measurement_configured") return "configured";
  if (event === "measurement_skipped") return "skipped";
  return "pending";
}

function updateFor(event: GuidanceEvent, current: GuidanceProgressRecord | null, now: Date) {
  switch (event) {
    case "inventory_completed":
      return { inventoryCompletedAt: current?.inventoryCompletedAt ?? now };
    case "spending_viewed":
      return { spendingViewedAt: current?.spendingViewedAt ?? now };
    case "review_viewed":
      return { reviewViewedAt: current?.reviewViewedAt ?? now };
    case "measurement_configured":
      return { measurementChoice: "configured" as const };
    case "measurement_skipped":
      return { measurementChoice: "skipped" as const };
    case "measurement_reset":
      return { measurementChoice: "pending" as const, completedAt: null };
  }
}
