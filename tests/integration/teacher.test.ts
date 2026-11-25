import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, seedPlan, CLASS, STUDENTS, PLAN } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

const OTHER = '00000000-0000-4000-8000-0000000000c2';
let sql: Awaited<ReturnType<typeof resetTestDb>>;
beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await seedPlan(sql);
  await sql`insert into wp_classes (id, grade, name, class_code) values (${OTHER}, 2, 'Snapdragon G2', 'XYZ789')`;
  await sql`insert into wp_students (id, class_id, display_name, link_secret) values ('00000000-0000-4000-8000-000000000009', ${OTHER}, 'Zed', 'zed-secret')`;
});
afterAll(async () => { await sql.end(); });

describe('teacher queries', () => {
  it('lists classes with kid counts and star totals', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    // far-future "now" so every week is open
    await completeLesson(STUDENTS.mina.id, PLAN.lessons.one.id, new Date('2100-01-01T00:00:00Z'));
    const { listClasses } = await import('@/lib/db/teacher');
    const classes = await listClasses();
    const g1 = classes.find((c) => c.id === CLASS.id)!;
    expect(g1).toMatchObject({ name: 'Snapdragon G1', classCode: 'ABC234', kidCount: 3 });
    expect(g1.totalStars).toBeGreaterThanOrEqual(10);
    expect(classes.find((c) => c.id === OTHER)).toMatchObject({ kidCount: 1, totalStars: 0 });
  });

  it('class stats use the same star total the kid sees', async () => {
    const { classStats } = await import('@/lib/db/teacher');
    const { totalStarsFor } = await import('@/lib/db/kid');
    const view = (await classStats(CLASS.id))!;
    expect(view.className).toBe('Snapdragon G1');
    for (const r of view.rows) expect(r.stars).toBe(await totalStarsFor(r.studentId));
    expect(view.rows.find((r) => r.studentId === STUDENTS.mina.id)!.stars).toBeGreaterThan(0);
    expect(await classStats('not-a-uuid')).toBeNull();
    expect(await classStats('00000000-0000-4000-8000-00000000ffff')).toBeNull();
  });

  it('reads practice days and counts a soft-deleted question\'s attempt toward lastSkill', async () => {
    const leo = STUDENTS.leo.id;
    await sql`insert into wp_practice_days (student_id, day, seconds) values (${leo}, '2100-01-01', 300), (${leo}, '2100-01-02', 65)`;
    await sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context, created_at)
      values (${leo}, ${PLAN.questions.q1.id}, '00000000-0000-4000-8000-00000000a001', false, 'lesson', '2100-01-02T03:00:00Z')`;
    await sql`update wp_questions set deleted_at = now() where id = ${PLAN.questions.q1.id}`;
    const { classStats, studentDetail } = await import('@/lib/db/teacher');
    const row = (await classStats(CLASS.id))!.rows.find((r) => r.studentId === leo)!;
    expect(row.daysPracticed).toBe(2);
    expect(row.secondsPracticed).toBe(365);
    expect(row.lastSkill).toBe(PLAN.weeks.open.skill);
    const detail = (await studentDetail(leo))!;
    expect(detail.history).toEqual([{ skill: PLAN.weeks.open.skill, dates: ['2100-01-02'] }]);
    expect(detail.className).toBe('Snapdragon G1');
    expect(JSON.stringify(detail)).not.toMatch(/correct|score/i);
  });

  it('setDisplayName trims, bounds, and updates', async () => {
    const { setDisplayName, studentDetail } = await import('@/lib/db/teacher');
    await setDisplayName(STUDENTS.jun.id, '  June  ');
    expect((await studentDetail(STUDENTS.jun.id))!.student.displayName).toBe('June');
    await expect(setDisplayName(STUDENTS.jun.id, '   ')).rejects.toThrow();
    await expect(setDisplayName(STUDENTS.jun.id, 'x'.repeat(41))).rejects.toThrow();
    await setDisplayName(STUDENTS.jun.id, 'x'.repeat(40));
    await expect(setDisplayName('00000000-0000-4000-8000-00000000ffff', 'Nobody')).rejects.toThrow();
    expect(await studentDetail('nope')).toBeNull();
  });
});
