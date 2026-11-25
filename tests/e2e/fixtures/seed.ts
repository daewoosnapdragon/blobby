// Fake data for e2e tests. Later tasks add their own rows via seedExtra helpers; keep these ids stable.
import type postgres from 'postgres';
import { seoulDate } from '../../../src/lib/dates';

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/wp_e2e_test';
export const E2E_SESSION_SECRET = 'e2e-session-secret-not-real';
export const E2E_PORT = 3100;

export const CLASS = { id: '00000000-0000-4000-8000-0000000000c1', grade: 1, name: 'Snapdragon G1', code: 'ABC234' };

export const STUDENTS = {
  mina: { id: '00000000-0000-4000-8000-000000000001', name: 'Mina', color: null as string | null, secret: 'e2e-secret-mina-0000000000000000000000' },
  leo: { id: '00000000-0000-4000-8000-000000000002', name: 'Leo', color: 'mint' as string | null, secret: 'e2e-secret-leo-00000000000000000000000' },
  jun: { id: '00000000-0000-4000-8000-000000000003', name: 'Jun', color: null as string | null, secret: 'e2e-secret-jun-00000000000000000000000' },
};

export async function seed(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`insert into wp_classes (id, grade, name, class_code) values (${CLASS.id}, ${CLASS.grade}, ${CLASS.name}, ${CLASS.code})`;
  for (const s of Object.values(STUDENTS)) {
    await sql`insert into wp_students (id, class_id, display_name, blob_color, link_secret)
      values (${s.id}, ${CLASS.id}, ${s.name}, ${s.color}, ${s.secret})`;
  }
}

// ---- A winter plan for the kid-screen tests (Task 8). Kept out of seed() so integration tests that build
// their own plans aren't affected; tests/e2e/setup-db.ts calls both.
const pid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const PLAN = {
  id: pid(0xe100),
  title: 'E2E winter plan',
  weeks: {
    open: { id: pid(0xe200), skill: 'Past tense' },
    locked: { id: pid(0xe201), skill: 'Plural nouns' },
    later: { id: pid(0xe203), skill: 'Asking questions', opensOn: '2099-01-01' },
    final: { id: pid(0xe202), skill: 'Treasure review', opensOn: '2099-01-05' },
  },
  lessons: {
    one: { id: pid(0xe300), title: 'Yesterday' },
    two: { id: pid(0xe301), title: 'Last week' },
    locked: { id: pid(0xe302), title: 'Two or more' },
    final: { id: pid(0xe303), title: 'Big review' },
    later: { id: pid(0xe304), title: 'Who and what' },
  },
  questions: {
    q1: {
      id: pid(0xe400), type: 'pick_one',
      payload: { prompt: 'Which one is about yesterday?', choices: ['I walk to school.', 'I walked to school.'], answer: 1 },
      // a URL that 404s: "Hear it" must show "Try again" and the question stays answerable
      audio: { 'Which one is about yesterday?': '/no-such-audio.mp3' },
    },
    q2: {
      id: pid(0xe401), type: 'fill_blank',
      payload: { before: 'Yesterday, we', after: 'pizza.', choices: ['eat', 'ate'], answer: 1 },
      audio: {},
    },
    q3: {
      id: pid(0xe402), type: 'pick_one',
      payload: { prompt: 'Which one is right?', choices: ['She goed home.', 'She went home.'], answer: 1 },
      audio: {},
    },
    q4: {
      id: pid(0xe403), type: 'pick_one',
      payload: { prompt: 'Which one is right?', choices: ['They played tag.', 'They playing tag.'], answer: 0 },
      audio: {},
    },
  },
} as const;

/** Seoul date `days` from now, as YYYY-MM-DD. */
export function seoulDaysFromNow(days: number, now = new Date()): string {
  return seoulDate(new Date(now.getTime() + days * 86_400_000));
}

export async function seedPlan(sql: ReturnType<typeof postgres>): Promise<void> {
  const { weeks: w, lessons: l, questions: q } = PLAN;
  await sql`insert into wp_plans (id, title, kind) values (${PLAN.id}, ${PLAN.title}, 'winter')`;
  await sql`insert into wp_plan_assignments (plan_id, class_id) values (${PLAN.id}, ${CLASS.id})`;
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values
    (${w.open.id}, ${PLAN.id}, 1, ${w.open.skill}, '2026-01-01'),
    (${w.locked.id}, ${PLAN.id}, 2, ${w.locked.skill}, ${seoulDaysFromNow(3)}),
    (${w.later.id}, ${PLAN.id}, 3, ${w.later.skill}, ${w.later.opensOn}),
    (${w.final.id}, ${PLAN.id}, 4, ${w.final.skill}, ${w.final.opensOn})`;
  await sql`insert into wp_lessons (id, week_id, position, title) values
    (${l.one.id}, ${w.open.id}, 1, ${l.one.title}),
    (${l.two.id}, ${w.open.id}, 2, ${l.two.title}),
    (${l.locked.id}, ${w.locked.id}, 1, ${l.locked.title}),
    (${l.final.id}, ${w.final.id}, 1, ${l.final.title}),
    (${l.later.id}, ${w.later.id}, 1, ${l.later.title})`;
  const rows: [typeof q[keyof typeof q], string, number][] = [
    [q.q1, l.one.id, 1], [q.q2, l.one.id, 2], [q.q3, l.two.id, 1], [q.q4, l.two.id, 2],
    [{ ...q.q3, id: pid(0xe404) }, l.locked.id, 1], [{ ...q.q4, id: pid(0xe405) }, l.final.id, 1],
    [{ ...q.q4, id: pid(0xe406) }, l.later.id, 1],
  ];
  for (const [question, lessonId, position] of rows) {
    await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio)
      values (${question.id}, ${lessonId}, ${position}, ${question.type}, ${sql.json(question.payload as never)}, ${sql.json(question.audio as never)})`;
  }
}
