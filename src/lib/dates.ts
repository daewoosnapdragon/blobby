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
