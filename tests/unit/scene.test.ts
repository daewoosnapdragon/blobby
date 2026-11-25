import { describe, expect, it } from 'vitest';
import { blobScene, SEOLLAL_DATES } from '@/lib/scene';

// Noon Seoul on the given date (UTC+9, no DST).
const seoul = (ymd: string, hh = '12:00:00') => new Date(`${ymd}T${hh}+09:00`);
const snow = (ymd: string) => blobScene(seoul(ymd), 12).snow;
const hat = (ymd: string) => blobScene(seoul(ymd), 12).hat;

describe('blobScene snow (Seoul date, Dec 20 to Feb 28)', () => {
  it('starts Dec 20 and not before', () => {
    expect(snow('2026-12-19')).toBe(false);
    expect(snow('2026-12-20')).toBe(true);
    expect(snow('2026-12-31')).toBe(true);
    expect(snow('2027-01-15')).toBe(true);
  });
  it('ends after Feb 28', () => {
    expect(snow('2027-02-28')).toBe(true);
    expect(snow('2027-03-01')).toBe(false);
    expect(snow('2026-06-15')).toBe(false);
  });
  it('uses the Seoul date at UTC edge instants', () => {
    expect(blobScene(new Date('2026-12-19T14:59:59Z'), 12).snow).toBe(false); // 23:59:59 Seoul Dec 19
    expect(blobScene(new Date('2026-12-19T15:00:00Z'), 12).snow).toBe(true); // 00:00 Seoul Dec 20
    expect(blobScene(new Date('2027-02-28T14:59:59Z'), 12).snow).toBe(true); // 23:59:59 Seoul Feb 28
    expect(blobScene(new Date('2027-02-28T15:00:00Z'), 12).snow).toBe(false); // 00:00 Seoul Mar 1
  });
});

describe('blobScene hat', () => {
  it('santa on Dec 24 and 25 only', () => {
    expect(hat('2026-12-23')).toBeNull();
    expect(hat('2026-12-24')).toBe('santa');
    expect(hat('2026-12-25')).toBe('santa');
    expect(hat('2026-12-26')).toBeNull();
  });
  it('santa follows the Seoul date at the UTC edge', () => {
    expect(blobScene(new Date('2026-12-23T15:00:00Z'), 12).hat).toBe('santa');
    expect(blobScene(new Date('2026-12-25T15:00:00Z'), 12).hat).toBeNull();
  });
  it('seollal on every SEOLLAL_DATES date, none the day before or after', () => {
    expect(SEOLLAL_DATES).toEqual(['2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09']);
    expect(hat('2027-02-05')).toBeNull();
    for (const d of SEOLLAL_DATES) expect(hat(d)).toBe('seollal');
    expect(hat('2027-02-10')).toBeNull();
  });
  it('no hat on an ordinary day', () => {
    expect(hat('2026-11-25')).toBeNull();
  });
});

describe('blobScene nudge (device local hour)', () => {
  const n = (h: number) => blobScene(seoul('2026-11-25'), h).nudge;
  it('morning before 9', () => {
    expect(n(0)).toBe('morning');
    expect(n(8)).toBe('morning');
    expect(n(9)).toBeNull();
  });
  it('bedtime from 21', () => {
    expect(n(20)).toBeNull();
    expect(n(21)).toBe('bedtime');
    expect(n(23)).toBe('bedtime');
  });
  it('does not depend on the Seoul date', () => {
    expect(blobScene(seoul('2026-12-24'), 22).nudge).toBe('bedtime');
    expect(blobScene(seoul('2026-12-24'), 22).hat).toBe('santa');
  });
});
