import { describe, expect, it } from 'vitest';
import { monthGrid, shiftMonth, monthOf, monthTitle, dayLabel, canGoNext } from '@/lib/calendar';

describe('monthGrid', () => {
  it('lays out December 2025 Sunday-first (Dec 1 is a Monday)', () => {
    const g = monthGrid('2025-12');
    expect(g).toHaveLength(5);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0]).toEqual([null, '2025-12-01', '2025-12-02', '2025-12-03', '2025-12-04', '2025-12-05', '2025-12-06']);
    expect(g[4]).toEqual(['2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', null, null, null]);
  });
  it('handles a month starting on Sunday and a leap February', () => {
    expect(monthGrid('2026-02')[0][0]).toBe('2026-02-01'); // Sunday
    expect(monthGrid('2026-02')).toHaveLength(4);
    expect(monthGrid('2024-02').flat().filter(Boolean)).toHaveLength(29);
  });
  it('needs six rows when a 31-day month starts on Friday/Saturday', () => {
    expect(monthGrid('2025-08')).toHaveLength(6); // Aug 1 2025 is a Friday
  });
});

describe('month helpers', () => {
  it('shifts across year edges', () => {
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('monthOf, title, label', () => {
    expect(monthOf('2026-01-10')).toBe('2026-01');
    expect(monthTitle('2025-12')).toBe('December 2025');
    expect(dayLabel('2025-12-03', true)).toBe('December 3, practiced');
    expect(dayLabel('2025-12-03', false)).toBe('December 3');
  });
  it('canGoNext stops at the current month', () => {
    expect(canGoNext('2026-01', '2026-01')).toBe(false);
    expect(canGoNext('2025-12', '2026-01')).toBe(true);
  });
});
