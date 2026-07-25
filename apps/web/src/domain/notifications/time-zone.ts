const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function localHour(at: Date, timeZone: string): number {
  const hour = formatterFor(timeZone)
    .formatToParts(at)
    .find((part) => part.type === "hour")?.value;
  if (hour === undefined) throw new RangeError("time zone hour is unavailable");
  return Number(hour);
}

export function isWithinDeliveryHours(
  at: Date,
  timeZone: string,
  startHour: number,
  endHour: number,
): boolean {
  const hour = localHour(at, timeZone);
  return hour >= startHour && hour < endHour;
}

export function nextDeliveryWindowStart(
  now: Date,
  timeZone: string,
  startHour: number,
  endHour: number,
): Date {
  if (isWithinDeliveryHours(now, timeZone, startHour, endHour)) return now;

  const minute = 60 * 1000;
  let candidate = new Date(Math.floor(now.getTime() / minute) * minute + minute);
  for (let offset = 0; offset <= 26 * 60; offset += 1) {
    if (isWithinDeliveryHours(candidate, timeZone, startHour, endHour)) return candidate;
    candidate = new Date(candidate.getTime() + minute);
  }
  throw new RangeError("next notification delivery window could not be resolved");
}
