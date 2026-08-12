/**
 * Attendance window helpers.
 *
 * A mark is "outside the window" when it happens BEFORE the earliest allowed
 * time: office start minus `checkInEarlyWindowMinutes` for check-in, office
 * end minus `checkOutEarlyWindowMinutes` for check-out. Outside-window marks
 * require a staff-provided reason.
 *
 * Comparisons use the wall clock in the configured timezone, so the client
 * (device clock) and the server agree regardless of their host timezone.
 */

export type WindowSettings = {
  officeStartTime: string;
  officeEndTime: string;
  checkInEarlyWindowMinutes: number;
  checkOutEarlyWindowMinutes: number;
  timezone: string;
};

/** Wall-clock minutes since midnight for `date` in the given IANA zone. */
export function minutesInZone(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** Parse "HH:MM" (optionally with seconds) into minutes since midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * True when a mark of `kind` at `date` falls earlier than the allowed window
 * (before office start minus the early window / office end minus the early
 * window). Windows that would start before midnight clamp to 00:00.
 */
export function isOutsideWindow(
  kind: "CHECK_IN" | "CHECK_OUT",
  s: WindowSettings,
  date: Date,
): boolean {
  const nowMinutes = minutesInZone(date, s.timezone);
  if (kind === "CHECK_IN") {
    const boundary =
      hhmmToMinutes(s.officeStartTime) - s.checkInEarlyWindowMinutes;
    return nowMinutes < Math.max(0, boundary);
  }
  const boundary = hhmmToMinutes(s.officeEndTime) - s.checkOutEarlyWindowMinutes;
  return nowMinutes < Math.max(0, boundary);
}
