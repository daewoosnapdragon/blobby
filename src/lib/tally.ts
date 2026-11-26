import type { NonWatchQuestion } from '@/lib/questions/schema';

/** What a kid did this session, by question type (pure). Words for sort_it, questions otherwise. */
export type Tally = Partial<Record<NonWatchQuestion['type'], number>>;

export function addToTally(t: Tally, q: NonWatchQuestion): Tally {
  const add = q.type === 'sort_it' ? q.items.length : 1;
  return { ...t, [q.type]: (t[q.type] ?? 0) + add };
}

/** Also the tie order. */
const COPY: [NonWatchQuestion['type'], string, string, string][] = [
  ['build_it', 'You built', 'sentence', 'sentences'],
  ['find_fix', 'You fixed', 'mistake', 'mistakes'],
  ['sort_it', 'You sorted', 'word', 'words'],
  ['fill_blank', 'You filled', 'blank', 'blanks'],
  ['pick_one', 'You picked', 'right sentence', 'right sentences'],
  ['listen_tap', 'You matched', 'word', 'words'],
];

export function tallyLines(t: Tally): string[] {
  return COPY.map(([type, verb, one, many], order) => ({ n: t[type] ?? 0, order, verb, noun: (t[type] ?? 0) === 1 ? one : many }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.order - b.order)
    .slice(0, 3)
    .map((r) => `${r.verb} ${r.n} ${r.noun}`);
}
