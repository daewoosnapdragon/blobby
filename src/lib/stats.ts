import { seoulDate } from './dates';

export interface StatStudent { id: string; displayName: string; blobColor: string | null }
export interface StatLesson { id: string; weekId: string; weekSkill: string }
export interface StatAttempt { studentId: string; questionId: string; lessonId: string; createdAt: Date }

export interface ClassStatsInput {
  students: StatStudent[];
  starEvents: { studentId: string; amount: number }[];
  practiceDays: { studentId: string; day: string; seconds: number }[];
  completions: { studentId: string; lessonId: string }[];
  lessons: StatLesson[];
  attempts: StatAttempt[];
}

export interface StudentStats {
  studentId: string;
  displayName: string;
  blobColor: string | null;
  stars: number;
  daysPracticed: number;
  secondsPracticed: number;
  weeksDone: number;
  lastSkill: string | null;
}

/** Completion numbers only: no scores, no right/wrong counts. */
export function computeClassStats(input: ClassStatsInput): StudentStats[] {
  const skillOf = new Map(input.lessons.map((l) => [l.id, l.weekSkill]));
  const lessonsByWeek = new Map<string, string[]>();
  for (const l of input.lessons) lessonsByWeek.set(l.weekId, [...(lessonsByWeek.get(l.weekId) ?? []), l.id]);

  return input.students.map((s) => {
    const stars = input.starEvents.filter((e) => e.studentId === s.id).reduce((n, e) => n + e.amount, 0);
    const days = input.practiceDays.filter((d) => d.studentId === s.id);
    const done = new Set(input.completions.filter((c) => c.studentId === s.id).map((c) => c.lessonId));
    const weeksDone = [...lessonsByWeek.values()].filter((ids) => ids.length > 0 && ids.every((id) => done.has(id))).length;

    // Newest attempt whose lesson is known. Soft-deleted questions don't matter: only the lesson is read.
    let last: StatAttempt | null = null;
    for (const a of input.attempts) {
      if (a.studentId !== s.id || !skillOf.has(a.lessonId)) continue;
      if (!last || a.createdAt > last.createdAt) last = a;
    }
    return {
      studentId: s.id,
      displayName: s.displayName,
      blobColor: s.blobColor,
      stars,
      daysPracticed: new Set(days.map((d) => d.day)).size,
      secondsPracticed: days.reduce((n, d) => n + d.seconds, 0),
      weeksDone,
      lastSkill: last ? skillOf.get(last.lessonId)! : null,
    };
  });
}

/** The skills this kid practiced, each with distinct Asia/Seoul dates (newest first); skills ordered by latest practice. */
export function skillHistory(
  studentId: string,
  input: { attempts: StatAttempt[]; lessons: StatLesson[] },
): { skill: string; dates: string[] }[] {
  const skillOf = new Map(input.lessons.map((l) => [l.id, l.weekSkill]));
  const bySkill = new Map<string, Set<string>>();
  for (const a of input.attempts) {
    const skill = skillOf.get(a.lessonId);
    if (a.studentId !== studentId || !skill) continue;
    if (!bySkill.has(skill)) bySkill.set(skill, new Set());
    bySkill.get(skill)!.add(seoulDate(a.createdAt));
  }
  return [...bySkill.entries()]
    .map(([skill, set]) => ({ skill, dates: [...set].sort().reverse() }))
    .sort((a, b) => (a.dates[0] < b.dates[0] ? 1 : a.dates[0] > b.dates[0] ? -1 : a.skill.localeCompare(b.skill)));
}

/** Seconds as h:mm (minutes floored). */
export function formatDuration(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
