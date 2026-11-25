import type { NonWatchQuestion } from '@/lib/questions/schema';

/** idle: answering; right/wrong: feedback is showing and taps are ignored until Try again / Next. */
export type Status = 'idle' | 'right' | 'wrong';

export type QProps<T extends NonWatchQuestion['type']> = {
  q: Extract<NonWatchQuestion, { type: T }>;
  status: Status;
  /** called with checkAnswer's result on every check (the player decides what to record) */
  onAnswer: (correct: boolean) => void;
};

export type Mark = 'right' | 'wrong' | 'selected' | undefined;

/** Deterministic shuffle (server and client render the same order). Never returns the original order for 2+ items. */
export function seededShuffle<T>(items: T[], seedText: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619) >>> 0;
  const out = items.map((v, i) => ({ v, i }));
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x.i === i)) out.push(out.shift()!);
  return out.map((x) => x.v);
}
