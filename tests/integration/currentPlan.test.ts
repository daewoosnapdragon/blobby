import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

// The spec's order of work: the test plan is live for the in-class test weeks, and the winter plan is
// imported (newer created_at, weeks in the future) while the test weeks are still running.
let sql: Awaited<ReturnType<typeof resetTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLS = id(1), KID = id(2);
const TEST = id(10), WINTER = id(11);
const T1 = id(20), T2 = id(21), W1 = id(22), W2 = id(23);
const L = { t1: id(30), t2: id(31), w1: id(32), w2: id(33) };

const DURING_TESTS = new Date('2026-12-08T03:00:00Z'); // both test weeks open, no winter week yet
const WINTER_OPEN = new Date('2027-01-06T03:00:00Z'); // winter week 1 open

beforeAll(async () => {
  sql = await resetTestDb();
  await sql`insert into wp_classes (id, grade, name, class_code) values (${CLS}, 3, 'G3', 'CUR333')`;
  await sql`insert into wp_students (id, class_id, display_name, link_secret) values (${KID}, ${CLS}, 'Kid', 'cur-secret')`;
  await sql`insert into wp_plans (id, title, kind, created_at) values
    (${TEST}, 'Test weeks', 'test', '2026-11-20'), (${WINTER}, 'Winter', 'winter', '2026-12-03')`;
  await sql`insert into wp_plan_assignments (plan_id, class_id) values (${TEST}, ${CLS}), (${WINTER}, ${CLS})`;
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values
    (${T1}, ${TEST}, 1, 'Test one', '2026-12-01'), (${T2}, ${TEST}, 2, 'Test two', '2026-12-07'),
    (${W1}, ${WINTER}, 1, 'Winter one', '2027-01-05'), (${W2}, ${WINTER}, 2, 'Winter two', '2027-01-12')`;
  await sql`insert into wp_lessons (id, week_id, position, title) values
    (${L.t1}, ${T1}, 1, 'T1'), (${L.t2}, ${T2}, 1, 'T2'), (${L.w1}, ${W1}, 1, 'W1'), (${L.w2}, ${W2}, 1, 'W2')`;
});
afterAll(async () => {
  await sql.end();
});

describe('the current plan on home', () => {
  it('is the test plan while its weeks are open and not done, even though winter was imported later', async () => {
    const { getHome } = await import('@/lib/db/kid');
    const h = await getHome(KID, DURING_TESTS);
    expect(h.plan).toEqual({ id: TEST, title: 'Test weeks' });
    expect(h.weeks.map((w) => w.id)).toEqual([T1, T2]);
    expect(h.currentWeekId).toBe(T1);
  });

  it('stays the test plan when its weeks are done but no winter week is open yet', async () => {
    const { getHome } = await import('@/lib/db/kid');
    await sql`insert into wp_lesson_completions (student_id, lesson_id) values (${KID}, ${L.t1}), (${KID}, ${L.t2})`;
    const h = await getHome(KID, DURING_TESTS);
    expect(h.plan?.id).toBe(TEST);
    expect(h.currentWeekId).toBe(T2);
  });

  it('moves to the winter plan once the test weeks are done and a winter week opens', async () => {
    const { getHome } = await import('@/lib/db/kid');
    const h = await getHome(KID, WINTER_OPEN);
    expect(h.plan).toEqual({ id: WINTER, title: 'Winter' });
    expect(h.weeks.map((w) => w.id)).toEqual([W1, W2]);
    expect(h.currentWeekId).toBe(W1);
  });

  it('falls back to the newest plan when no plan has an open week', async () => {
    const { getHome } = await import('@/lib/db/kid');
    const h = await getHome(KID, new Date('2026-10-01T03:00:00Z'));
    expect(h.plan?.id).toBe(WINTER);
    expect(h.currentWeekId).toBeNull();
  });
});

describe('getWeek (the week page)', () => {
  it('serves an open week of any assigned plan, not only the current one', async () => {
    const { getWeek, getHome } = await import('@/lib/db/kid');
    expect((await getHome(KID, WINTER_OPEN)).plan?.id).toBe(WINTER);
    const t = await getWeek(KID, T1, WINTER_OPEN); // the test plan is no longer current, its week still opens
    expect(t).not.toBeNull();
    expect(t!.week).toMatchObject({ id: T1, number: 1, skill: 'Test one', open: true, done: true });
    expect(t!.week.lessons).toEqual([{ id: L.t1, title: 'T1', done: true }]);
    expect(t!.student).toMatchObject({ id: KID, displayName: 'Kid' });
    const w = await getWeek(KID, W1, WINTER_OPEN);
    expect(w!.week).toMatchObject({ id: W1, open: true, done: false });
  });

  it('returns null for a locked week, an unassigned plan, or a bad id', async () => {
    const { getWeek } = await import('@/lib/db/kid');
    expect(await getWeek(KID, W1, DURING_TESTS)).toBeNull(); // not open yet
    const other = id(40), ow = id(41);
    await sql`insert into wp_plans (id, title, kind) values (${other}, 'Not mine', 'winter')`;
    await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values (${ow}, ${other}, 1, 'x', '2026-12-01')`;
    expect(await getWeek(KID, ow, DURING_TESTS)).toBeNull();
    expect(await getWeek(KID, 'nope', DURING_TESTS)).toBeNull();
  });
});
