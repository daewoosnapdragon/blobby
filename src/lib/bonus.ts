/** Deterministic bonus-question picks (pure; the server decides, the client never guesses). */

/** FNV-1a 32-bit over UTF-16 code units. */
export function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** The lesson's one bonus question, or null when the lesson has none. */
export function pickLessonBonus(questionIds: string[], seed: string): string | null {
  if (questionIds.length === 0) return null;
  return questionIds[hash32(seed) % questionIds.length];
}

/** About one practice question in eight is a bonus, stable for a student, day and question. */
export function isPracticeBonus(studentId: string, seoulDate: string, questionId: string): boolean {
  return hash32(`${studentId}:${seoulDate}:${questionId}`) % 8 === 0;
}

export function lessonBonusSeed(studentId: string, lessonId: string, redo: boolean): string {
  return `${studentId}:${lessonId}:bonus${redo ? ':redo' : ''}`;
}
