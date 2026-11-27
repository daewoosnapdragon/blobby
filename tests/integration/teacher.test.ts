import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

  it('reissueLink replaces the secret: old stops resolving, new does', async () => {
    const { reissueLink } = await import('@/lib/db/teacher');
    const { studentBySecret } = await import('@/lib/db/kid');
    expect((await studentBySecret(STUDENTS.leo.secret))!.id).toBe(STUDENTS.leo.id);
    const fresh = await reissueLink(STUDENTS.leo.id);
    expect(fresh).not.toBe(STUDENTS.leo.secret);
    expect(fresh.length).toBeGreaterThanOrEqual(30);
    expect(await studentBySecret(STUDENTS.leo.secret)).toBeNull();
    expect((await studentBySecret(fresh))!.id).toBe(STUDENTS.leo.id);
    await expect(reissueLink('00000000-0000-4000-8000-00000000ffff')).rejects.toThrow();
    await expect(reissueLink('nope')).rejects.toThrow();
  });

  it('cardsForClass lists secrets for the class, or one kid', async () => {
    const { cardsForClass } = await import('@/lib/db/teacher');
    const all = (await cardsForClass(CLASS.id))!;
    expect(all.classCode).toBe('ABC234');
    expect(all.students.map((s) => s.displayName)).toEqual(['Leo', 'Mina', 'x'.repeat(40)]);
    expect(all.students.every((s) => s.secret.length > 10)).toBe(true);
    const one = (await cardsForClass(CLASS.id, STUDENTS.mina.id))!;
    expect(one.students).toHaveLength(1);
    expect(one.students[0].secret).toBe(STUDENTS.mina.secret);
    expect(await cardsForClass('nope')).toBeNull();
    expect((await cardsForClass(CLASS.id, 'nope'))!.students).toEqual([]);
  });
});

describe('missing audio', () => {
  const VOICE = 'test-voice';
  /** A fake voice + storage; `failOn` makes the nth synthesize call (1-based) throw. */
  function fakeAudio(failOn?: number) {
    const files = new Set<string>();
    let calls = 0;
    const synthesize = vi.fn(async (text: string) => {
      calls += 1;
      if (calls === failOn) throw new Error('voice service is down');
      return Buffer.from(`mp3:${text}`);
    });
    return {
      synthesize, files,
      deps: async () => ({
        voice: VOICE, synthesize,
        storage: {
          exists: async (k: string) => files.has(k),
          upload: async (k: string) => { files.add(k); },
          publicUrl: (k: string) => `https://audio.test/${k}.mp3`,
        },
      }),
    };
  }
  const audioOf = async (id: string) => (await sql<{ audio: Record<string, string> }[]>`select audio from wp_questions where id = ${id}`)[0].audio;
  const bankId = (n: number) => `00000000-0000-4000-8000-0000000ab${String(n).padStart(3, '0')}`;
  async function bankRow(n: number, type: string, payload: unknown, opts: { skill?: string; position?: number } = {}) {
    await sql`insert into wp_questions (id, bank_grade, skill, position, type, payload)
      values (${bankId(n)}, 1, ${opts.skill ?? 'past_tense'}, ${opts.position ?? n}, ${type}, ${sql.json(payload as never)})`;
  }

  it('counts missing strings over lessons and banks, skipping deleted and malformed rows', async () => {
    const { countMissingAudio } = await import('@/lib/db/teacher');
    const before = await countMissingAudio();
    // seeded lesson rows: q1 is soft-deleted above; q2..e406 are six rows of three strings with no audio
    expect(before).toBe(18);
    await bankRow(1, 'pick_one', { prompt: 'Bank one?', choices: ['A one.', 'B one.'], answer: 0 });
    await bankRow(2, 'pick_one', { prompt: 'Bank two?', choices: ['A two.', 'B two.'], answer: 0 });
    await bankRow(3, 'pick_one', { prompt: 'Bank three?', choices: ['A three.', 'B three.'], answer: 0 });
    await bankRow(4, 'pick_one', { prompt: 'Bank four?', choices: ['A four.', 'B four.'], answer: 0 });
    await bankRow(5, 'pick_one', { nonsense: true }); // malformed: skipped, never crashes
    expect(await countMissingAudio()).toBe(30);
  });

  it('makes audio for about `limit` strings, whole rows at a time, and reports what is left', async () => {
    const { fillMissingAudio, countMissingAudio } = await import('@/lib/db/teacher');
    const { audioKey } = await import('@/lib/tts');
    const deletedBefore = await audioOf(PLAN.questions.q1.id);
    const a = fakeAudio();
    const r = await fillMissingAudio(20, { audio: a.deps });
    // every row has 3 missing strings, so 7 whole rows cover the 20
    expect(r).toEqual({ done: 21, remaining: 9 });
    expect(await countMissingAudio()).toBe(9);
    expect(a.synthesize).toHaveBeenCalled(); // fewer than 21: seeded rows share sentences and storage keeps one file per text
    expect(await audioOf(PLAN.questions.q1.id)).toEqual(deletedBefore); // deleted rows untouched
    expect(await audioOf(PLAN.questions.q2.id)).toEqual({
      'Yesterday, we … pizza.': `https://audio.test/${audioKey('Yesterday, we … pizza.', VOICE)}.mp3`,
      eat: `https://audio.test/${audioKey('eat', VOICE)}.mp3`,
      ate: `https://audio.test/${audioKey('ate', VOICE)}.mp3`,
    });
    const rest = await fillMissingAudio(20, { audio: a.deps });
    expect(rest).toEqual({ done: 9, remaining: 0 });
    expect(await fillMissingAudio(20, { audio: a.deps })).toEqual({ done: 0, remaining: 0 });
  });

  it('stops at the first failure, keeps rows already saved, and the next call resumes', async () => {
    const { fillMissingAudio, countMissingAudio } = await import('@/lib/db/teacher');
    // three one-string rows (build_it speaks only its prompt), after everything else already has audio
    for (const n of [11, 12, 13]) {
      await bankRow(n, 'build_it', { prompt: `Build sentence ${n}.`, tiles: ['I', 'ran.'] }, { skill: 'zz_last', position: n });
    }
    expect(await countMissingAudio()).toBe(3);
    const failing = fakeAudio(3);
    const r = await fillMissingAudio(20, { audio: failing.deps });
    expect(r.done).toBe(2);
    expect(r.remaining).toBe(1);
    expect(r.error).toMatch(/voice service is down/);
    expect(Object.keys(await audioOf(bankId(11)))).toEqual(['Build sentence 11.']);
    expect(Object.keys(await audioOf(bankId(12)))).toEqual(['Build sentence 12.']);
    expect(await audioOf(bankId(13))).toEqual({});
    const again = await fillMissingAudio(20, { audio: fakeAudio().deps });
    expect(again).toEqual({ done: 1, remaining: 0 });
    expect(Object.keys(await audioOf(bankId(13)))).toEqual(['Build sentence 13.']);
  });

  it('starts no new row once the overall deadline has passed, keeping the rows already saved', async () => {
    const { fillMissingAudio, countMissingAudio } = await import('@/lib/db/teacher');
    // four one-string rows, after everything else already has audio
    for (const n of [21, 22, 23, 24]) {
      await bankRow(n, 'build_it', { prompt: `Build sentence ${n}.`, tiles: ['I', 'ran.'] }, { skill: 'zz_slow', position: n });
    }
    expect(await countMissingAudio()).toBe(4);
    const slow = fakeAudio();
    const inner = slow.synthesize.getMockImplementation()!;
    slow.synthesize.mockImplementation(async (text: string) => {
      await new Promise((r) => setTimeout(r, 250));
      return inner(text);
    });
    // row 1 starts (always), row 2 starts at ~250 ms (< 400), row 3 would start at ~500 ms (>= 400): stop there
    const r = await fillMissingAudio(20, { audio: slow.deps, deadlineMs: 400 });
    expect(r).toEqual({ done: 2, remaining: 2 });
    expect(slow.synthesize).toHaveBeenCalledTimes(2);
    expect(Object.keys(await audioOf(bankId(21)))).toEqual(['Build sentence 21.']);
    expect(Object.keys(await audioOf(bankId(22)))).toEqual(['Build sentence 22.']);
    expect(await audioOf(bankId(23))).toEqual({});
    expect(await audioOf(bankId(24))).toEqual({});
    expect(await countMissingAudio()).toBe(2);
    // the next call carries on from where this one stopped
    expect(await fillMissingAudio(20, { audio: fakeAudio().deps })).toEqual({ done: 2, remaining: 0 });
  });
});
