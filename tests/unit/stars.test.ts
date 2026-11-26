import { describe, it, expect } from 'vitest';
import { STAR_VALUES, weekBonusDue } from '@/lib/stars';

describe('stars', () => {
  it('has the agreed values', () => {
    expect(STAR_VALUES).toEqual({ lesson: 10, weekBonus: 10, freeCorrect: 1, lessonBonus: 2, freeBonus: 2 });
  });
  it('weekBonusDue is true only when every lesson is complete', () => {
    expect(weekBonusDue(['a', 'b'], new Set(['a', 'b']))).toBe(true);
    expect(weekBonusDue(['a', 'b'], new Set(['a']))).toBe(false);
    expect(weekBonusDue(['a', 'b'], new Set(['a', 'x']))).toBe(false);
    expect(weekBonusDue(['a'], new Set(['a', 'b']))).toBe(true);
  });
  it('a week with no lessons is never due', () => {
    expect(weekBonusDue([], new Set())).toBe(false);
    expect(weekBonusDue([], new Set(['a']))).toBe(false);
  });
});
