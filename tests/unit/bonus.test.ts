import { describe, it, expect } from 'vitest';
import { pickLessonBonus, isPracticeBonus, lessonBonusSeed } from '@/lib/bonus';

describe('bonus', () => {
  it('pickLessonBonus is stable, in the list, and null for an empty list', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const p = pickLessonBonus(ids, 's1:l1:bonus');
    expect(ids).toContain(p);
    expect(pickLessonBonus(ids, 's1:l1:bonus')).toBe(p);
    expect(pickLessonBonus([], 'x')).toBeNull();
  });
  it('different seeds spread over the list', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pickLessonBonus(ids, `seed${i}`)));
    expect(picks.size).toBeGreaterThan(1);
  });
  it('lessonBonusSeed adds :redo only for a redo', () => {
    expect(lessonBonusSeed('s', 'l', false)).toBe('s:l:bonus');
    expect(lessonBonusSeed('s', 'l', true)).toBe('s:l:bonus:redo');
  });
  it('isPracticeBonus is stable and about one in eight', () => {
    const n = Array.from({ length: 1600 }, (_, i) => isPracticeBonus('kid', '2026-01-10', `q${i}`)).filter(Boolean).length;
    expect(n).toBeGreaterThan(120);
    expect(n).toBeLessThan(280);
    expect(isPracticeBonus('kid', '2026-01-10', 'q1')).toBe(isPracticeBonus('kid', '2026-01-10', 'q1'));
  });
});
