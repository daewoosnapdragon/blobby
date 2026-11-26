// Practice-calendar stamps. Each practiced day shows one stamp from this set, picked from the kid and the date,
// so a day keeps its stamp on every visit. To add a stamp: put a square transparent image at
// public/stamps/<name>.webp (about 256 px) and add <name> here; days then get a mix.
export const STAMPS = ['star'] as const;

export function stampSrc(name: string): string {
  return `/stamps/${name}.webp`;
}

/** FNV-1a: a small, stable string hash (same answer on server and in tests). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The stamp for one kid's practiced day. */
export function stampFor(studentId: string, day: string, set: readonly string[] = STAMPS): string {
  return set[hash(`${studentId}:${day}`) % set.length];
}
