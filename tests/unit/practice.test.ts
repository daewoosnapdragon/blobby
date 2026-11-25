import { describe, it, expect } from 'vitest';
import { pickFreePractice } from '@/lib/practice';

/** Tiny deterministic PRNG so the odds test never flakes. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pool = (n: number, deleted: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({ id: `q${i}`, deleted: deleted.includes(i) }));

describe('pickFreePractice', () => {
  it('shows a missed question about 3x as often over 1,000 seeded runs', () => {
    const rand = mulberry32(12345);
    const p = pool(40);
    const missed = new Set(['q0']);
    let hitMissed = 0;
    let hitOther = 0; // q1..q39 averaged below
    for (let run = 0; run < 1000; run++) {
      for (const id of pickFreePractice(p, missed, 8, rand)) {
        if (id === 'q0') hitMissed++;
        else hitOther++;
      }
    }
    const ratio = hitMissed / (hitOther / 39);
    expect(ratio).toBeGreaterThan(2.5);
    expect(ratio).toBeLessThan(3.5);
  });

  it('never returns a deleted id, even if it is marked missed (Review Focus #4)', () => {
    const rand = mulberry32(7);
    const p = pool(12, [2, 5, 9]);
    const missed = new Set(['q2', 'q5', 'q1']);
    for (let run = 0; run < 500; run++) {
      const ids = pickFreePractice(p, missed, 8, rand);
      for (const bad of ['q2', 'q5', 'q9']) expect(ids).not.toContain(bad);
    }
  });

  it('returns min(n, pool size) unique ids', () => {
    const rand = mulberry32(99);
    const ids = pickFreePractice(pool(20), new Set(['q3', 'q4']), 8, rand);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);

    const small = pickFreePractice(pool(5), new Set(), 8, rand);
    expect(small).toHaveLength(5);
    expect(new Set(small).size).toBe(5);

    // deleted entries do not count toward the pool size
    expect(pickFreePractice(pool(10, [0, 1, 2, 3, 4, 5, 6]), new Set(), 8, rand)).toHaveLength(3);
    expect(pickFreePractice([], new Set(), 8, rand)).toEqual([]);
  });

  it('defaults to 8 and ignores duplicate ids in the pool', () => {
    const ids = pickFreePractice([...pool(10), ...pool(10)], new Set());
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
  });
});
