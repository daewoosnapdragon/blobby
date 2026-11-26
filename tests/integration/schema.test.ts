import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetTestDb } from './helpers/db';

const TABLES = [
  'wp_classes', 'wp_students', 'wp_plans', 'wp_plan_assignments', 'wp_weeks',
  'wp_lessons', 'wp_questions', 'wp_attempts', 'wp_lesson_completions',
  'wp_star_events', 'wp_practice_days', 'wp_student_skills', 'wp_track_runs',
];

let sql: Awaited<ReturnType<typeof resetTestDb>>;
beforeAll(async () => { sql = await resetTestDb(); });
afterAll(async () => { await sql?.end(); });

async function rejects(p: PromiseLike<unknown>, code: string) {
  await expect(Promise.resolve(p)).rejects.toMatchObject({ code });
}
const CHECK = '23514', UNIQUE = '23505';

describe('lockdown', () => {
  it('has all 13 tables', async () => {
    const rows = await sql`select tablename from pg_tables where schemaname='public' and tablename like 'wp\\_%'`;
    expect(rows.map((r) => r.tablename).sort()).toEqual([...TABLES].sort());
  });
  it('enables RLS on every table', async () => {
    const rows = await sql`select relname, relrowsecurity from pg_class where relname = any(${TABLES}) and relkind='r'`;
    expect(rows).toHaveLength(TABLES.length);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });
  it('has zero policies on wp_ tables', async () => {
    const rows = await sql`select 1 from pg_policies where tablename like 'wp\\_%'`;
    expect(rows).toHaveLength(0);
  });
  it('gives anon and authenticated no privileges', async () => {
    for (const role of ['anon', 'authenticated'])
      for (const t of TABLES)
        for (const priv of ['select', 'insert', 'update', 'delete', 'references', 'trigger', 'truncate']) {
          const [r] = await sql`select has_table_privilege(${role}, ${'public.' + t}, ${priv}) as ok`;
          expect(r.ok, `${role} ${priv} ${t}`).toBe(false);
        }
  });
});

describe('anon role', () => {
  it('is denied at runtime', async () => {
    await expect(sql.begin(async (tx) => {
      await tx.unsafe('set local role anon');
      await tx.unsafe('select * from wp_students');
    })).rejects.toMatchObject({ code: '42501' });
  });
});

describe('constraints', () => {
  let classId: string, studentId: string, planId: string, weekId: string, lessonId: string, questionId: string;
  beforeAll(async () => {
    [{ id: classId }] = await sql`insert into wp_classes (grade, name, class_code) values (2, 'Maple', 'MAPLE2') returning id`;
    [{ id: studentId }] = await sql`insert into wp_students (id, class_id, display_name, link_secret) values (gen_random_uuid(), ${classId}, 'Mimi', 's1') returning id`;
    [{ id: planId }] = await sql`insert into wp_plans (title, kind) values ('Winter', 'winter') returning id`;
    [{ id: weekId }] = await sql`insert into wp_weeks (plan_id, position, skill) values (${planId}, 1, 'phonics') returning id`;
    [{ id: lessonId }] = await sql`insert into wp_lessons (week_id, position, title) values (${weekId}, 1, 'L1') returning id`;
    [{ id: questionId }] = await sql`insert into wp_questions (lesson_id, position, type, payload) values (${lessonId}, 1, 'mc', '{}') returning id`;
  });

  it('class_code is unique', async () => {
    await rejects(sql`insert into wp_classes (grade, name, class_code) values (2, 'x', 'MAPLE2')`, UNIQUE);
  });
  it('plan kind is checked', async () => {
    await rejects(sql`insert into wp_plans (title, kind) values ('x', 'bogus')`, CHECK);
  });
  it('plan_assignments needs exactly one of class_id/student_id', async () => {
    await sql`insert into wp_plan_assignments (plan_id, class_id) values (${planId}, ${classId})`;
    await sql`insert into wp_plan_assignments (plan_id, student_id) values (${planId}, ${studentId})`;
    await rejects(sql`insert into wp_plan_assignments (plan_id) values (${planId})`, CHECK);
    await rejects(sql`insert into wp_plan_assignments (plan_id, class_id, student_id) values (${planId}, ${classId}, ${studentId})`, CHECK);
  });
  it('questions default audio to {} and deleted_at to null', async () => {
    const [q] = await sql`select audio, deleted_at, updated_at from wp_questions where id=${questionId}`;
    expect(q.audio).toEqual({});
    expect(q.deleted_at).toBeNull();
    expect(q.updated_at).toBeTruthy();
  });
  it('attempts: client_attempt_id unique, context checked', async () => {
    const cid = '11111111-1111-4111-8111-111111111111';
    await sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context) values (${studentId}, ${questionId}, ${cid}, true, 'lesson')`;
    await rejects(sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context) values (${studentId}, ${questionId}, ${cid}, false, 'free')`, UNIQUE);
    await rejects(sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context) values (${studentId}, ${questionId}, gen_random_uuid(), true, 'other')`, CHECK);
  });
  it('lesson_completions unique(student_id, lesson_id)', async () => {
    await sql`insert into wp_lesson_completions (student_id, lesson_id) values (${studentId}, ${lessonId})`;
    await rejects(sql`insert into wp_lesson_completions (student_id, lesson_id) values (${studentId}, ${lessonId})`, UNIQUE);
  });
  it('star_events unique(student_id, reason, ref_id), reason checked', async () => {
    await sql`insert into wp_star_events (student_id, plan_id, amount, reason, ref_id) values (${studentId}, ${planId}, 10, 'lesson', ${lessonId})`;
    await rejects(sql`insert into wp_star_events (student_id, plan_id, amount, reason, ref_id) values (${studentId}, ${planId}, 10, 'lesson', ${lessonId})`, UNIQUE);
    await rejects(sql`insert into wp_star_events (student_id, plan_id, amount, reason, ref_id) values (${studentId}, ${planId}, 10, 'nope', ${lessonId})`, CHECK);
  });
  it('star_events ref_id is required', async () => {
    await rejects(sql`insert into wp_star_events (student_id, plan_id, amount, reason) values (${studentId}, ${planId}, 10, 'lesson')`, '23502');
  });
  it('plan title, week position, lesson position are unique; question positions are not', async () => {
    await rejects(sql`insert into wp_plans (title, kind) values ('Winter', 'winter')`, UNIQUE);
    await rejects(sql`insert into wp_weeks (plan_id, position, skill) values (${planId}, 1, 'x')`, UNIQUE);
    await rejects(sql`insert into wp_lessons (week_id, position, title) values (${weekId}, 1, 'x')`, UNIQUE);
    await sql`insert into wp_questions (lesson_id, position, type, payload) values (${lessonId}, 1, 'mc', '{}')`;
  });
  it('date columns round-trip as YYYY-MM-DD strings', async () => {
    await sql`insert into wp_practice_days (student_id, day) values (${studentId}, '2026-12-28')`;
    const [r] = await sql`select day from wp_practice_days where student_id=${studentId} and day='2026-12-28'`;
    expect(r.day).toBe('2026-12-28');
    await sql`delete from wp_practice_days where day='2026-12-28'`;
  });
  it('practice_days primary key (student_id, day), seconds default 0', async () => {
    await sql`insert into wp_practice_days (student_id, day) values (${studentId}, '2026-12-01')`;
    const [r] = await sql`select seconds from wp_practice_days where student_id=${studentId}`;
    expect(r.seconds).toBe(0);
    await rejects(sql`insert into wp_practice_days (student_id, day) values (${studentId}, '2026-12-01')`, UNIQUE);
  });
});

describe('practice students', () => {
  it('is_preview defaults to false and a class has at most one practice student', async () => {
    const [c] = await sql`insert into wp_classes (grade, name, class_code) values (3, 'Preview check', 'PRV234') returning id`;
    const [kid] = await sql`insert into wp_students (id, class_id, display_name, link_secret)
      values (gen_random_uuid(), ${c.id}, 'Kid', 'prv-kid') returning is_preview`;
    expect(kid.is_preview).toBe(false);
    await sql`insert into wp_students (id, class_id, display_name, link_secret, is_preview) values (gen_random_uuid(), ${c.id}, 'Teacher', 'prv-1', true)`;
    await rejects(sql`insert into wp_students (id, class_id, display_name, link_secret, is_preview) values (gen_random_uuid(), ${c.id}, 'Teacher', 'prv-2', true)`, UNIQUE);
  });
});

describe('review tracks', () => {
  it('a bank question has a grade instead of a lesson; exactly one of the two', async () => {
    await sql`insert into wp_questions (bank_grade, position, type, payload, skill) values (3, 1, 'pick_one', '{}'::jsonb, 'past-tense')`;
    await rejects(sql`insert into wp_questions (position, type, payload) values (1, 'pick_one', '{}'::jsonb)`, CHECK);
    const [c] = await sql`insert into wp_classes (grade, name, class_code) values (3, 'Bank check', 'BNK234') returning id`;
    const [p] = await sql`insert into wp_plans (title, kind) values ('Bank check plan', 'test') returning id`;
    const [w] = await sql`insert into wp_weeks (plan_id, position, skill) values (${p.id}, 1, 'x') returning id`;
    const [l] = await sql`insert into wp_lessons (week_id, position, title) values (${w.id}, 1, 'x') returning id`;
    await rejects(sql`insert into wp_questions (lesson_id, bank_grade, position, type, payload) values (${l.id}, 3, 1, 'pick_one', '{}'::jsonb)`, CHECK);
    void c;
  });
  it('attempts can carry a run id', async () => {
    const [col] = await sql`select data_type from information_schema.columns where table_name = 'wp_attempts' and column_name = 'run_id'`;
    expect(col.data_type).toBe('uuid');
  });
  it('wp_student_skills exists, is locked down, and checks its values', async () => {
    const [t] = await sql`select relrowsecurity from pg_class where relname = 'wp_student_skills'`;
    expect(t.relrowsecurity).toBe(true);
    const [g] = await sql`select has_table_privilege('anon', 'wp_student_skills', 'select') as anon`;
    expect(g.anon).toBe(false);
    const [c] = await sql`insert into wp_classes (grade, name, class_code) values (2, 'Skill check', 'SKL234') returning id`;
    const [s] = await sql`insert into wp_students (id, class_id, display_name, link_secret) values (gen_random_uuid(), ${c.id}, 'K', 'skl-1') returning id`;
    const [row] = await sql`insert into wp_student_skills (student_id, skill, source, state) values (${s.id}, 'past-tense', 'pretest', 'active') returning spacing, lessons_since, removed_by_teacher`;
    expect(row).toEqual({ spacing: 3, lessons_since: 0, removed_by_teacher: false });
    await rejects(sql`insert into wp_student_skills (student_id, skill, source, state) values (${s.id}, 'be', 'magic', 'active')`, CHECK);
    await rejects(sql`insert into wp_student_skills (student_id, skill, source, state) values (${s.id}, 'be', 'auto', 'gone')`, CHECK);
    await rejects(sql`insert into wp_student_skills (student_id, skill, source, state) values (${s.id}, 'past-tense', 'auto', 'active')`, UNIQUE);
  });
});
