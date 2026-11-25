const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Asia/Seoul calendar date of `now` as YYYY-MM-DD, regardless of device time zone. */
export function seoulDate(now: Date): string {
  return fmt.format(now);
}

/** A week is open once the Seoul date reaches its opens_on date (ISO strings compare correctly). */
export function isWeekOpen(opensOn: string, now: Date): boolean {
  return seoulDate(now) >= opensOn;
}

/** True for a real YYYY-MM-DD calendar date (rejects 2026-02-30 and 2026-2-3). */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(+d) && d.toISOString().startsWith(s);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Monday" for 2026-12-21. A calendar date has the same weekday everywhere, so no time zone is involved. Empty for a non-date. */
export function weekdayName(s: string): string {
  return isRealDate(s) ? WEEKDAYS[new Date(`${s}T00:00:00Z`).getUTCDay()] : '';
}
