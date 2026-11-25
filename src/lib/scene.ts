import { seoulDate } from '@/lib/dates';

/** Seollal holiday (Feb 6 to 9, 2027; Seollal itself is Feb 7). Add next year's dates here. */
export const SEOLLAL_DATES = ['2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09'];

export type Scene = {
  snow: boolean;
  hat: 'santa' | 'seollal' | null;
  nudge: 'morning' | 'bedtime' | null;
};

/**
 * What the blob's world looks like. `snow` and `hat` come from the Seoul date of `now`;
 * `nudge` comes from the device's local hour (the one place device time is used).
 */
export function blobScene(now: Date, localHour: number): Scene {
  const ymd = seoulDate(now);
  const md = ymd.slice(5);
  const snow = md >= '12-20' || md <= '02-28';
  const hat = md === '12-24' || md === '12-25' ? 'santa' : SEOLLAL_DATES.includes(ymd) ? 'seollal' : null;
  const nudge = localHour < 9 ? 'morning' : localHour >= 21 ? 'bedtime' : null;
  return { snow, hat, nudge };
}
