/** Free practice: pick a mixed set, with questions the kid missed coming back more often (spec 5.5). */

export const MISSED_WEIGHT = 3;
export const PRACTICE_SET_SIZE = 8;

/**
 * Picks up to `n` distinct question ids by weighted sampling without replacement: a missed question
 * weighs 3, any other 1. Deleted questions (and repeated ids) are dropped first, so they can never appear.
 */
export function pickFreePractice(
  pool: { id: string; deleted: boolean }[],
  missedIds: Set<string>,
  n: number = PRACTICE_SET_SIZE,
  rand: () => number = Math.random,
): string[] {
  const seen = new Set<string>();
  const left: { id: string; w: number }[] = [];
  for (const q of pool) {
    if (q.deleted || seen.has(q.id)) continue;
    seen.add(q.id);
    left.push({ id: q.id, w: missedIds.has(q.id) ? MISSED_WEIGHT : 1 });
  }

  const want = Math.min(n, left.length);
  const picked: string[] = [];

  // Anything too heavy to be spread by the step below (tiny pools) is simply taken.
  for (let again = true; again && picked.length < want; ) {
    again = false;
    const step = left.reduce((sum, x) => sum + x.w, 0) / (want - picked.length);
    const i = left.findIndex((x) => x.w >= step);
    if (i >= 0) {
      picked.push(left.splice(i, 1)[0].id);
      again = true;
    }
  }

  // Systematic sampling in random order: each question's chance of being in the set is exactly
  // proportional to its weight (a missed one is 3x as likely), and one question can't be drawn twice.
  const need = want - picked.length;
  if (need > 0) {
    shuffle(left, rand);
    const step = left.reduce((sum, x) => sum + x.w, 0) / need;
    let mark = rand() * step;
    let end = 0;
    for (const x of left) {
      end += x.w;
      while (mark < end && picked.length < want) {
        picked.push(x.id);
        mark += step;
      }
    }
  }
  // Fewer than asked can only happen through rounding at the very end; top up from whatever is left.
  for (const x of left) if (picked.length < want && !picked.includes(x.id)) picked.push(x.id);

  const ids = picked.slice();
  shuffle(ids, rand);
  return ids;
}

function shuffle<T>(a: T[], rand: () => number): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
