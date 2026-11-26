import { describe, it, expect } from 'vitest';
import { nextRoll, reactionFor, dingRate, sparklesAt } from '@/lib/roll';

describe('roll', () => {
  it('nextRoll counts first-try rights and resets on a first-try miss; retries change nothing', () => {
    expect(nextRoll(2, true, true)).toBe(3);
    expect(nextRoll(2, true, false)).toBe(0);
    expect(nextRoll(2, false, true)).toBe(2);
    expect(nextRoll(2, false, false)).toBe(2);
  });
  it('reactionFor: wobble when wrong; hop, cheer at 3, spin at 5, hop after', () => {
    expect(reactionFor(false, 0)).toBe('wobble');
    expect([1, 2, 4, 6].map((r) => reactionFor(true, r))).toEqual(['hop', 'hop', 'hop', 'hop']);
    expect(reactionFor(true, 3)).toBe('cheer');
    expect(reactionFor(true, 5)).toBe('spin');
  });
  it('dingRate steps by semitones and caps', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(dingRate)).toEqual([1, 1, 1.06, 1.12, 1.19, 1.26, 1.26]);
  });
  it('sparklesAt 3 and 5 only', () => {
    expect([1, 2, 3, 4, 5, 6].map(sparklesAt)).toEqual([false, false, true, false, true, false]);
  });
});
