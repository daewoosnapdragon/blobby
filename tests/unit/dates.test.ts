import { describe, it, expect } from 'vitest';
import { seoulDate, isWeekOpen } from '@/lib/dates';

describe('seoulDate', () => {
  it('rolls to next day at 15:00Z (midnight Seoul)', () => {
    expect(seoulDate(new Date('2026-12-27T15:30:00Z'))).toBe('2026-12-28');
    expect(seoulDate(new Date('2026-12-27T14:59:59Z'))).toBe('2026-12-27');
    expect(seoulDate(new Date('2026-12-27T15:00:00Z'))).toBe('2026-12-28');
  });
  it('ignores device time zone: UTC-constructed instants give the Seoul date', () => {
    // 2026-01-01 00:00 in Los Angeles (UTC-8) is 08:00Z, still Jan 1 17:00 in Seoul
    expect(seoulDate(new Date('2026-01-01T08:00:00Z'))).toBe('2026-01-01');
    // 2026-12-31 23:00 in New York (UTC-5) is Jan 1 04:00Z => Jan 1 13:00 Seoul
    expect(seoulDate(new Date('2027-01-01T04:00:00Z'))).toBe('2027-01-01');
  });
});

describe('isWeekOpen', () => {
  it('closed before Seoul midnight, open at it', () => {
    expect(isWeekOpen('2026-12-28', new Date('2026-12-27T14:59:00Z'))).toBe(false);
    expect(isWeekOpen('2026-12-28', new Date('2026-12-27T15:00:00Z'))).toBe(true);
  });
  it('open after the date too', () => {
    expect(isWeekOpen('2026-12-28', new Date('2027-02-01T00:00:00Z'))).toBe(true);
  });
});
