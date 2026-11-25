// Month-calendar helpers for the stamps page. Pure; dates are YYYY-MM-DD strings (Asia/Seoul calendar days).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const parts = (month: string) => ({ y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) });

/** Weeks of a month, Sunday first: each cell is a YYYY-MM-DD string, or null for padding. */
export function monthGrid(month: string): (string | null)[][] {
  const { y, m } = parts(month);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const { y, m } = parts(month);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export function monthTitle(month: string): string {
  const { y, m } = parts(month);
  return `${MONTHS[m - 1]} ${y}`;
}

export function dayLabel(date: string, practiced: boolean): string {
  const base = `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
  return practiced ? `${base}, practiced` : base;
}

export const canGoNext = (month: string, currentMonth: string) => month < currentMonth;

/** A ?month= value that is a real past-or-present month, else the current one. */
export function pickMonth(raw: string | undefined, currentMonth: string): string {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= currentMonth && raw >= '2020-01' ? raw : currentMonth;
}
