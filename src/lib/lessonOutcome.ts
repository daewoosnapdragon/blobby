// What the lesson-done moment shows (ruling R24). Pure.

export interface LessonPageState {
  /** the kid the page was rendered for */
  studentId: string;
  lessonDone: boolean;
  weekDone: boolean;
  otherLessonsDone: boolean;
}
export interface CompleteResult { studentId: string; starsAwarded: number; weekDone: boolean; lessonStars?: number; bonusStars?: number }

/**
 * firstTime: this completion earned the lesson's stars. A retried POST returns {0, false}, so the page's own
 * knowledge ("not done before") also counts, but only while the page still belongs to the kid who was written to.
 * toWeekDone: the week is done now and wasn't before.
 */
export function lessonOutcome(page: LessonPageState, res: CompleteResult): { firstTime: boolean; toWeekDone: boolean } {
  const same = res.studentId === page.studentId;
  return {
    firstTime: res.starsAwarded > 0 || (same && !page.lessonDone),
    toWeekDone: res.weekDone || (same && !page.weekDone && page.otherLessonsDone),
  };
}
