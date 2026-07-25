import { describe, expect, it } from "vitest";
import { buildAccountDeletionNotificationPlan } from "./deletion";

const DELETION_AT = new Date("2027-01-01T03:00:00.000Z");

describe("削除予定通知の日程", () => {
  it("通常の無活動アカウントは90・30・7日前", () => {
    expect(
      buildAccountDeletionNotificationPlan({
        reason: "inactive_account",
        deletionAt: DELETION_AT,
      }),
    ).toEqual([
      { checkpoint: "90_days", notifyAt: new Date("2026-10-03T03:00:00.000Z") },
      { checkpoint: "30_days", notifyAt: new Date("2026-12-02T03:00:00.000Z") },
      { checkpoint: "7_days", notifyAt: new Date("2026-12-25T03:00:00.000Z") },
    ]);
  });

  it("空アカウントは7日前だけ", () => {
    expect(
      buildAccountDeletionNotificationPlan({
        reason: "empty_account",
        deletionAt: DELETION_AT,
      }),
    ).toEqual([{ checkpoint: "7_days", notifyAt: new Date("2026-12-25T03:00:00.000Z") }]);
  });

  it("削除専用コードは申請直後と24時間前", () => {
    const requestedAt = new Date("2026-12-20T03:00:00.000Z");
    expect(
      buildAccountDeletionNotificationPlan({
        reason: "deletion_code",
        deletionAt: DELETION_AT,
        requestedAt,
      }),
    ).toEqual([
      { checkpoint: "requested", notifyAt: requestedAt },
      { checkpoint: "24_hours", notifyAt: new Date("2026-12-31T03:00:00.000Z") },
    ]);
  });

  it("TestFlight終了は7日前と終了時", () => {
    expect(
      buildAccountDeletionNotificationPlan({
        reason: "testflight_end",
        deletionAt: DELETION_AT,
      }),
    ).toEqual([
      { checkpoint: "7_days", notifyAt: new Date("2026-12-25T03:00:00.000Z") },
      { checkpoint: "end", notifyAt: DELETION_AT },
    ]);
  });

  it("Apple再認証による即時退会は通知しない", () => {
    expect(
      buildAccountDeletionNotificationPlan({
        reason: "immediate_reauthentication",
        deletionAt: DELETION_AT,
      }),
    ).toEqual([]);
  });
});
