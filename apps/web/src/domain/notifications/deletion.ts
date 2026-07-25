const DAY_MS = 24 * 60 * 60 * 1000;

export type AccountDeletionReason =
  | "inactive_account"
  | "empty_account"
  | "deletion_code"
  | "testflight_end"
  | "immediate_reauthentication";

export type AccountDeletionCheckpoint =
  | "90_days"
  | "30_days"
  | "7_days"
  | "requested"
  | "24_hours"
  | "end";

export type AccountDeletionNotificationPlanItem = {
  checkpoint: AccountDeletionCheckpoint;
  notifyAt: Date;
};

function before(date: Date, days: number): Date {
  return new Date(date.getTime() - days * DAY_MS);
}

export function buildAccountDeletionNotificationPlan(input: {
  reason: AccountDeletionReason;
  deletionAt: Date;
  requestedAt?: Date;
}): AccountDeletionNotificationPlanItem[] {
  switch (input.reason) {
    case "inactive_account":
      return [
        { checkpoint: "90_days", notifyAt: before(input.deletionAt, 90) },
        { checkpoint: "30_days", notifyAt: before(input.deletionAt, 30) },
        { checkpoint: "7_days", notifyAt: before(input.deletionAt, 7) },
      ];
    case "empty_account":
      return [{ checkpoint: "7_days", notifyAt: before(input.deletionAt, 7) }];
    case "deletion_code":
      if (!input.requestedAt) {
        throw new Error("requestedAt is required for deletion-code schedules");
      }
      return [
        { checkpoint: "requested", notifyAt: input.requestedAt },
        { checkpoint: "24_hours", notifyAt: before(input.deletionAt, 1) },
      ];
    case "testflight_end":
      return [
        { checkpoint: "7_days", notifyAt: before(input.deletionAt, 7) },
        { checkpoint: "end", notifyAt: input.deletionAt },
      ];
    case "immediate_reauthentication":
      return [];
  }
}
