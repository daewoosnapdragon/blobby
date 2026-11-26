import { describe, expect, it } from 'vitest';
import { STAMPS, stampFor, stampSrc } from '@/lib/stamps';

const KID = '00000000-0000-4000-8000-000000000001';

describe('stampFor', () => {
  it('always gives the same stamp for the same kid and day', () => {
    expect(stampFor(KID, '2026-11-26')).toBe(stampFor(KID, '2026-11-26'));
  });
  it('only gives stamps from the set', () => {
    for (let d = 1; d <= 28; d++) expect(STAMPS).toContain(stampFor(KID, `2026-11-${String(d).padStart(2, '0')}`));
  });
  it('spreads days across a larger set', () => {
    const set = ['star', 'heart', 'moon', 'flower'];
    const seen = new Set(Array.from({ length: 60 }, (_, i) => stampFor(KID, `2026-12-${String((i % 31) + 1).padStart(2, '0')}-${i}`, set)));
    expect(seen.size).toBe(set.length);
  });
  it('the star is in the set, with its file', () => {
    expect(STAMPS).toContain('star');
    expect(stampSrc('star')).toBe('/stamps/star.webp');
  });
});
