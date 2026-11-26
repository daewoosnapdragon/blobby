import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, seedPlan, CLASS, STUDENTS, PLAN } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

const OTHER_CLASS = '00000000-0000-4000-8000-0000000000c9';
const GRADE2_KID = '00000000-0000-4000-8000-0000000000b2';
const MINA = STUDENTS.mina.id;
const LEO = STUDENTS.leo.id;
const JUN = STUDENTS.jun.id;
const pick = (prompt: string) => ({ prompt, choices: ['went', 'goed'], answer: 0 });

let sql: Awaited<ReturnType<typeof resetTestDb>>;
const bankIds: Record<string, string[]> = { 'past-tense': [], articles: [] };
let grade2BankId = '';

beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await seedPlan(sql);
  // class questions of lesson one carry skills
  await sql`update wp_questions set skill = 'was-were' where id in (${PLAN.questions.q1.id}, ${PLAN.questions.q2.id})`;
  for (const [skill, n] of [['past-tense', 5], ['articles', 3]] as const) {
    for (let i = 1; i <= n; i++) {
      const [r] = await sql`insert into wp_questions (bank_grade, skill, position, type, payload) values (${CLASS.grade}, ${skill}, ${i}, 'pick_one', ${sql.json(pick(`${skill} ${i}`) as never)}) returning id`;
      bankIds[skill].push(r.id);
    }
  }
  const [g2] = await sql`insert into wp_questions (bank_grade, skill, position, type, payload) values (2, 'past-tense', 1, 'pick_one', ${sql.json(pick('grade 2') as never)}) returning id`;
  grade2BankId = g2.id;
  await sql`insert into wp_classes (id, grade, name, class_code) values (${OTHER_CLASS}, 2, 'Snapdragon G2', 'GRD222')`;
  await sql`insert into wp_students (id, class_id, display_name, link_secret) values (${GRADE2_KID}, ${OTHER_CLASS}, 'Two', 'grade-2-secret')`;
});
afterAll(async () => { await sql.end(); });

const db = async () => ({ kid: await import('@/lib/db/kid'), teacher: await import('@/lib/db/teacher') });

describe('review tracks in lessons', () => {
  it('a kid with no skills gets just the class questions', async () => {
    const { kid } = await db();
    const l = await kid.getLesson(JUN, PLAN.lessons.one.id);
    expect(l.questions).toHaveLength(2);
    expect(l.questions.every((q) => !q.forYou)).toBe(true);
    expect(l.questions.map((q) => q.skill)).toEqual(['was-were', 'was-were']);
  });

  it('a kid with skills gets 3 "just for you" questions from the bank, the same on reload', async () => {
    const { kid, teacher } = await db();
    await teacher.setStudentSkill(MINA, 'past-tense', 'add');
    await teacher.setStudentSkill(MINA, 'articles', 'add');
    const a = await kid.getLesson(MINA, PLAN.lessons.one.id);
    const forYou = a.questions.filter((q) => q.forYou);
    expect(forYou).toHaveLength(3);
    for (const q of forYou) expect([...bankIds['past-tense'], ...bankIds.articles]).toContain(q.id);
    expect(new Set(forYou.map((q) => q.skill))).toEqual(new Set(['past-tense', 'articles']));
    const b = await kid.getLesson(MINA, PLAN.lessons.one.id);
    expect(b.questions.map((q) => q.id)).toEqual(a.questions.map((q) => q.id));
  });

  it('a skill with no bank questions just adds nothing', async () => {
    const { kid, teacher } = await db();
    await teacher.setStudentSkill(LEO, 'comma-splice', 'add');
    const l = await kid.getLesson(LEO, PLAN.lessons.one.id);
    expect(l.questions.filter((q) => q.forYou)).toHaveLength(0);
  });

  it('a bank question takes answers from kids of its grade only', async () => {
    const { kid } = await db();
    await expect(kid.recordAttempt(MINA, { clientAttemptId: randomUUID(), questionId: bankIds['past-tense'][0], correct: true, context: 'lesson', runId: randomUUID() })).resolves.toBeDefined();
    await expect(kid.recordAttempt(MINA, { clientAttemptId: randomUUID(), questionId: grade2BankId, correct: true, context: 'lesson' })).rejects.toBeInstanceOf(kid.NotFoundError);
    await expect(kid.recordAttempt(GRADE2_KID, { clientAttemptId: randomUUID(), questionId: bankIds['past-tense'][1], correct: true, context: 'lesson' })).rejects.toBeInstanceOf(kid.NotFoundError);
  });

  it('missing a skill twice in a lesson run adds it to the track, once even if "finished" is sent twice', async () => {
    const { kid, teacher } = await db();
    const run = randomUUID();
    for (const q of [PLAN.questions.q1.id, PLAN.questions.q2.id]) {
      await kid.recordAttempt(JUN, { clientAttemptId: randomUUID(), questionId: q, correct: false, context: 'lesson', runId: run });
    }
    const first = await kid.completeLesson(JUN, PLAN.lessons.one.id, new Date(), run);
    await kid.completeLesson(JUN, PLAN.lessons.one.id, new Date(), run);
    expect(first.starsAwarded).toBeGreaterThan(0);
    const skills = await teacher.studentSkills(JUN);
    expect(skills.filter((s) => s.skill === 'was-were')).toEqual([expect.objectContaining({ source: 'auto', state: 'active' })]);
    const [{ n }] = await sql`select count(*)::int as n from wp_track_runs where student_id = ${JUN}`;
    expect(n).toBe(1);
  });

  it('a skill Kyla removed is not added back by misses', async () => {
    const { kid, teacher } = await db();
    await teacher.setStudentSkill(JUN, 'was-were', 'remove');
    const run = randomUUID();
    for (const q of [PLAN.questions.q1.id, PLAN.questions.q2.id]) {
      await kid.recordAttempt(JUN, { clientAttemptId: randomUUID(), questionId: q, correct: false, context: 'lesson', runId: run });
    }
    await kid.completeLesson(JUN, PLAN.lessons.one.id, new Date(), run);
    expect((await teacher.studentSkills(JUN)).find((s) => s.skill === 'was-were')).toMatchObject({ state: 'removed', removedByTeacher: true });
    await teacher.setStudentSkill(JUN, 'was-were', 'add');
    expect((await teacher.studentSkills(JUN)).find((s) => s.skill === 'was-were')).toMatchObject({ state: 'active', source: 'teacher', removedByTeacher: false });
  });

  it('6 right answers in a row master a skill', async () => {
    const { kid, teacher } = await db();
    await teacher.setStudentSkill(LEO, 'past-tense', 'add');
    await sql`update wp_student_skills set source = 'pretest' where student_id = ${LEO} and skill = 'past-tense'`;
    const run = randomUUID();
    for (const id of bankIds['past-tense']) {
      await kid.recordAttempt(LEO, { clientAttemptId: randomUUID(), questionId: id, correct: true, context: 'lesson', runId: run });
    }
    await kid.recordAttempt(LEO, { clientAttemptId: randomUUID(), questionId: bankIds['past-tense'][0], correct: true, context: 'free' });
    await kid.completeLesson(LEO, PLAN.lessons.one.id, new Date(), run);
    expect((await teacher.studentSkills(LEO)).find((s) => s.skill === 'past-tense')).toMatchObject({ state: 'mastered', spacing: 3 });
  });

  it('Practice again: up to 5 questions on one skill, the kid’s missed ones first', async () => {
    const { kid } = await db();
    await kid.recordAttempt(MINA, { clientAttemptId: randomUUID(), questionId: bankIds['past-tense'][3], correct: false, context: 'free' });
    const set = await kid.getSkillPractice(MINA, 'past-tense');
    expect(set.length).toBeGreaterThan(0);
    expect(set.length).toBeLessThanOrEqual(5);
    expect(set[0].id).toBe(bankIds['past-tense'][3]);
    expect(set.every((q) => q.skill === 'past-tense')).toBe(true);
  });
});
