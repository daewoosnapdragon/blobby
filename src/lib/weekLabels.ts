// Pure labels for the home rail. Dates are YYYY-MM-DD strings (Seoul calendar days), compared as UTC midnights.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const utc = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};

/** "Opens Monday" within 6 days of `today`, else "Opens Dec 28". A week with no date: "Opens soon". */
export function opensLabel(opensOn: string | null, today: string): string {
  if (!opensOn) return 'Opens soon';
  const at = utc(opensOn);
  const days = Math.round((at.getTime() - utc(today).getTime()) / 86_400_000);
  if (days >= 1 && days <= 6) return `Opens ${WEEKDAYS[at.getUTCDay()]}`;
  return `Opens ${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`;
}

const DONE_TILES = ['#B7E1D1', '#FFB5C1', '#A9D3FF', '#FFE59A'];

/** Done weeks get rotating pastel tiles: mint, pink, blue, yellow. */
export function weekTileColor(i: number): string {
  return DONE_TILES[i % DONE_TILES.length];
}
