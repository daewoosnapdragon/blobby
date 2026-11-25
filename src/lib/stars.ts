/** The only place star amounts live. */
export const STAR_VALUES = { lesson: 10, weekBonus: 10, freeCorrect: 1 } as const;

/** True when the week has lessons and every one of them is complete. A week with no lessons never earns a bonus. */
export function weekBonusDue(lessonIds: string[], completedIds: Set<string>): boolean {
  return lessonIds.length > 0 && lessonIds.every((id) => completedIds.has(id));
}
