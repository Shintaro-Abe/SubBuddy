export type RenewalCycle = "monthly" | "yearly";

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function occurrence(anchor: Date, cycle: RenewalCycle, offset: number): Date {
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();
  const anchorDay = anchor.getUTCDate();
  const anchorIsMonthEnd = anchorDay === daysInUtcMonth(anchorYear, anchorMonth);

  if (cycle === "yearly") {
    const year = anchorYear + offset;
    const day = Math.min(anchorDay, daysInUtcMonth(year, anchorMonth));
    return new Date(Date.UTC(year, anchorMonth, day));
  }

  const absoluteMonth = anchorMonth + offset;
  const year = anchorYear + Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12;
  const day = anchorIsMonthEnd
    ? daysInUtcMonth(year, month)
    : Math.min(anchorDay, daysInUtcMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

export function upcomingRenewalDate(
  anchor: Date | null,
  cycle: RenewalCycle,
  asOf = new Date(),
): Date | null {
  if (!anchor || Number.isNaN(anchor.getTime())) return null;
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  if (anchor >= today) return anchor;

  const roughOffset =
    cycle === "yearly"
      ? Math.max(0, today.getUTCFullYear() - anchor.getUTCFullYear())
      : Math.max(
          0,
          (today.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
            today.getUTCMonth() -
            anchor.getUTCMonth(),
        );

  let candidate = occurrence(anchor, cycle, roughOffset);
  if (candidate < today) candidate = occurrence(anchor, cycle, roughOffset + 1);
  return candidate;
}

export function isoDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function withRenewalDates<
  T extends {
    nextRenewalDate: Date | null;
    billingCycle: RenewalCycle;
    status: string;
  },
>(subscription: T, asOf = new Date()) {
  const upcoming =
    subscription.status === "active"
      ? upcomingRenewalDate(subscription.nextRenewalDate, subscription.billingCycle, asOf)
      : null;
  return {
    ...subscription,
    renewalAnchorDate: subscription.nextRenewalDate,
    upcomingRenewalDate: upcoming,
  };
}
