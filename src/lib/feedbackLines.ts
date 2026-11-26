import type { NonWatchQuestion } from '@/lib/questions/schema';

/** Feedback title pools and the line picker (pure). */
export const RIGHT_LINES: readonly string[] = [
  'That’s it!', 'Yes!', 'You got it.', 'Nice one.', 'Exactly.', 'That’s right.',
  'Perfect.', 'Well done.', 'You know this.', 'Right on.', 'Yep!', 'Nailed it.',
];
export const ALMOST_LINES: readonly string[] = [
  'Almost!', 'Not quite.', 'Close!', 'Try once more.', 'Hmm, not that one.', 'Look again.',
  'So close.', 'One more try.', 'Not yet.', 'Nearly!', 'Give it another go.', 'Take another look.',
];
export const ROLL3_LINES: readonly string[] = [
  'Three in a row!', 'You’re on a roll.', 'Look at you go!', 'Three for three.', 'Keep it up!',
];
export const ROLL5_LINES: readonly string[] = [
  'Five in a row!', 'Wow. Five!', 'Unstoppable.', 'You’re flying.', 'Five! Amazing.',
];

export function titlePool(correct: boolean, roll: number): readonly string[] {
  if (!correct) return ALMOST_LINES;
  if (roll === 3) return ROLL3_LINES;
  if (roll === 5) return ROLL5_LINES;
  return RIGHT_LINES;
}

/** A random line from the pool that differs from `last` (when the pool has 2+ lines). */
export function pickLine(pool: readonly string[], last: string | null, rand: () => number = Math.random): string {
  let i = Math.min(Math.floor(rand() * pool.length), pool.length - 1);
  if (pool.length > 1 && pool[i] === last) i = (i + 1) % pool.length;
  return pool[i];
}

/** Drops the end punctuation a word or choice carries ("umbrella." → "umbrella"), so the line reads cleanly. */
function bare(text: string): string {
  return text.trim().replace(/[\s.,!?;:]+$/, '');
}

/** A line that names the answer, for the types where it teaches something. */
export function answerLine(q: NonWatchQuestion): string | null {
  if (q.type === 'fill_blank') return `“${bare(q.choices[q.answer])}” fits!`;
  if (q.type === 'odd_one_out') return `“${bare(q.words[q.answer])}” doesn’t belong!`;
  if (q.type === 'find_fix') {
    const fix = bare(q.fixes[q.answer]);
    const wrong = bare(q.words[q.wrongIndex]);
    // A punctuation- or capitalization-only fix would read "Ben, not ben!": the bubble uses a pool line instead.
    if (fix.toLowerCase() === wrong.toLowerCase()) return null;
    return `${fix}, not ${wrong}!`;
  }
  return null;
}
