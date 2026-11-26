/** The "on a roll" streak: consecutive first-try rights in a session (pure). */

/** A first try changes the roll (right +1, miss resets to 0); a retry leaves it alone. */
export function nextRoll(roll: number, firstTry: boolean, correct: boolean): number {
  if (!firstTry) return roll;
  return correct ? roll + 1 : 0;
}

export function reactionFor(correct: boolean, roll: number): 'hop' | 'wobble' | 'cheer' | 'spin' {
  if (!correct) return 'wobble';
  if (roll === 3) return 'cheer';
  if (roll === 5) return 'spin';
  return 'hop';
}

/** Playback rate for the ding: one semitone per roll step from the second, capped at five. */
export function dingRate(roll: number): number {
  if (roll <= 1) return 1;
  return Math.round(2 ** ((Math.min(roll, 5) - 1) / 12) * 100) / 100;
}

export function sparklesAt(roll: number): boolean {
  return roll === 3 || roll === 5;
}
