import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, seedPlan, CLASS, STUDENTS, PLAN } from '../e2e/fixtures/seed';
import { audioKey } from '@/lib/tts';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await seedPlan(sql);
});
afterAll(async () => { await sql.end(); });
afterEach(() => vi.unstubAllGlobals());

const LESSON = PLAN.lessons.one.id;
const NOW = new Date('2100-01-01T03:00:00Z');
const VOICE = 'test-voice';

/** A fake voice service and storage; nothing leaves the process. */
function fakeAudio() {
  const files = new Set<string>();
  const synthesize = vi.fn(async (text: string) => Buffer.from(`mp3:${text}`));
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

const pick = (prompt: string, choices = ['I walk.', 'I walked.']) => ({ prompt, choices, answer: 1 });
const audioOf = async (id: string) => (await sql<{ audio: Record<string, string> }[]>`select audio from wp_questions where id = ${id}`)[0].audio;

describe('saveQuestion', () => {
  it('creates a question at the next position and makes audio for its text', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const a = fakeAudio();
    const r = await saveQuestion(LESSON, 3, 'pick_one', pick('Which is yesterday?'), { audio: a.deps });
    expect(r.audio).toBe('ok');
    const [row] = await sql`select position, type, payload from wp_questions where id = ${r.id}`;
    expect(row.position).toBe(3);
    expect(row.type).toBe('pick_one');
    expect(a.synthesize).toHaveBeenCalledTimes(3);
    expect(await audioOf(r.id)).toEqual({
      'Which is yesterday?': `https://audio.test/${audioKey('Which is yesterday?', VOICE)}.mp3`,
      'I walk.': `https://audio.test/${audioKey('I walk.', VOICE)}.mp3`,
      'I walked.': `https://audio.test/${audioKey('I walked.', VOICE)}.mp3`,
    });
  });

  it('puts a new question after the last one whatever position it is given', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const a = fakeAudio();
    const r = await saveQuestion(LESSON, 99, 'pick_one', pick('Another one?'), { audio: a.deps });
    const [row] = await sql`select position from wp_questions where id = ${r.id}`;
    const [{ max }] = await sql`select max(position) from wp_questions where lesson_id = ${LESSON} and deleted_at is null and id <> ${r.id}`;
    expect(row.position).toBe(max + 1);
  });

  it('changed text makes a new audio key; unchanged text calls no synthesis', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const a = fakeAudio();
    const first = await saveQuestion(LESSON, 2, 'fill_blank', { before: 'Yesterday, we', after: 'pizza.', choices: ['eat', 'ate'], answer: 1 }, { audio: a.deps });
    expect(first.id).toBe(PLAN.questions.q2.id); // saved in place
    const calls = a.synthesize.mock.calls.length;
    const before = await audioOf(first.id);

    // same text again: nothing is synthesized
    await saveQuestion(LESSON, 2, 'fill_blank', { before: 'Yesterday, we', after: 'pizza.', choices: ['eat', 'ate'], answer: 1 }, { audio: a.deps });
    expect(a.synthesize.mock.calls.length).toBe(calls);

    // one word changed: only the new strings are synthesized, and the map has the new key
    await saveQuestion(LESSON, 2, 'fill_blank', { before: 'Yesterday, we', after: 'pizza.', choices: ['eat', 'ate', 'eaten'], answer: 1 }, { audio: a.deps });
    expect(a.synthesize.mock.calls.slice(calls).map((c) => c[0])).toEqual(['eaten']);
    const after = await audioOf(first.id);
    expect(after.eaten).toBe(`https://audio.test/${audioKey('eaten', VOICE)}.mp3`);
    expect(after.eaten).not.toBe(before.eaten);
    expect(after.ate).toBe(before.ate);
  });

  it('edits in place: same id, attempts stay valid, updated_at moves', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const a = fakeAudio();
    const id = PLAN.questions.q1.id;
    await sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context)
      values (${STUDENTS.leo.id}, ${id}, '00000000-0000-4000-8000-00000000b001', true, 'lesson')`;
    const [{ updated_at: t0 }] = await sql`select updated_at from wp_questions where id = ${id}`;
    await new Promise((r) => setTimeout(r, 15));
    const r = await saveQuestion(LESSON, 1, 'pick_one', pick('Which one is about yesterday?', ['I walk to school.', 'I walked to school.']), { audio: a.deps });
    expect(r.id).toBe(id);
    const [{ updated_at: t1 }] = await sql`select updated_at from wp_questions where id = ${id}`;
    expect(+t1).toBeGreaterThan(+t0);
    expect((await sql`select 1 from wp_attempts where question_id = ${id}`).length).toBe(1);
  });

  it('rejects an invalid question with readable messages and writes nothing', async () => {
    const { saveQuestion, EditorError } = await import('@/lib/db/teacher');
    const a = fakeAudio();
    const [{ n }] = await sql`select count(*)::int as n from wp_questions`;
    const err = await saveQuestion(LESSON, 1, 'pick_one', { prompt: '', choices: ['only one'], answer: 0 }, { audio: a.deps }).catch((e) => e);
    expect(err).toBeInstanceOf(EditorError);
    expect(err.problems.join(' | ')).toMatch(/Prompt/);
    expect(err.problems.join(' | ')).toMatch(/at least 2 choices/i);
    expect(err.problems.join(' ')).not.toMatch(/Too small|\(root\)/);
    expect((await sql`select count(*)::int as n from wp_questions`)[0].n).toBe(n);
    expect(a.synthesize).not.toHaveBeenCalled();
  });

  it('still saves when audio cannot be made, and says so', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const broken = async () => ({
      voice: VOICE,
      synthesize: async () => { throw new Error('TTS retired'); },
      storage: { exists: async () => false, upload: async () => {}, publicUrl: () => 'x' },
    });
    const r = await saveQuestion(LESSON, 3, 'pick_one', pick('Saved without sound?'), { audio: broken });
    expect(r.audio).toBe('failed');
    const [row] = await sql`select payload from wp_questions where id = ${r.id}`;
    expect(row.payload.prompt).toBe('Saved without sound?');
    // not configured at all (no deps given, no Supabase env): same outcome
    const r2 = await saveQuestion(LESSON, 3, 'pick_one', pick('No env either?'));
    expect(r2.audio).toBe('failed');
  });

  it('keeps the old audio of strings that did not change when audio fails', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const a = fakeAudio();
    const first = await saveQuestion(LESSON, 3, 'pick_one', pick('Keep my sound?'), { audio: a.deps });
    const old = await audioOf(first.id);
    const broken = async () => ({ voice: VOICE, synthesize: async () => { throw new Error('down'); }, storage: { exists: async () => false, upload: async () => {}, publicUrl: () => 'x' } });
    await saveQuestion(LESSON, 3, 'pick_one', pick('Keep my sound?', ['I walk.', 'I walked.', 'I walking.']), { audio: broken });
    // the id is the new question's position, so re-find it
    const [row] = await sql`select id, audio from wp_questions where id = ${first.id}`;
    expect(row.audio['Keep my sound?']).toBe(old['Keep my sound?']);
    expect(row.audio['I walking.']).toBeUndefined();
  });
});

describe('watch_answer video check', () => {
  const inner = [pick('What did you see?')];
  const ID = 'dQw4w9WgXcQ';
  const stub = (status: number) => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));

  it('stores the parsed id when the video can be embedded', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    stub(200);
    const r = await saveQuestion(LESSON, 9, 'watch_answer', { youtubeId: `https://youtu.be/${ID}?t=3`, questions: inner.map((q) => ({ type: 'pick_one', ...q })) }, { audio: fakeAudio().deps });
    const [row] = await sql`select payload from wp_questions where id = ${r.id}`;
    expect(row.payload.youtubeId).toBe(ID);
  });

  it.each([
    [403, /can't be played inside Blobby\. Try another link\./],
    [404, /couldn't find that video/i],
    [500, /Couldn't check the video right now\. Try again\./],
  ])('rejects with a readable message (status %s)', async (status, msg) => {
    const { saveQuestion, EditorError } = await import('@/lib/db/teacher');
    stub(status);
    const err = await saveQuestion(LESSON, 9, 'watch_answer', { youtubeId: ID, questions: inner.map((q) => ({ type: 'pick_one', ...q })) }, { audio: fakeAudio().deps }).catch((e) => e);
    expect(err).toBeInstanceOf(EditorError);
    expect(err.problems.join(' ')).toMatch(msg);
  });

  it('rejects a link that is not YouTube and never calls the network', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const err = await saveQuestion(LESSON, 9, 'watch_answer', { youtubeId: 'https://example.com/x', questions: inner.map((q) => ({ type: 'pick_one', ...q })) }, { audio: fakeAudio().deps }).catch((e) => e);
    expect(err.problems.join(' ')).toMatch(/YouTube link/);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('setWeek', () => {
  it('saves a trimmed skill and a real date', async () => {
    const { setWeek } = await import('@/lib/db/teacher');
    await setWeek(PLAN.weeks.open.id, { skill: '  Past tense, again  ', opensOn: '2026-02-03' });
    const [w] = await sql`select skill, opens_on from wp_weeks where id = ${PLAN.weeks.open.id}`;
    expect(w).toMatchObject({ skill: 'Past tense, again', opens_on: '2026-02-03' });
  });

  it.each([
    [{ skill: '   ', opensOn: '2026-02-03' }],
    [{ skill: 'x'.repeat(61), opensOn: '2026-02-03' }],
    [{ skill: 'Fine', opensOn: '2026-2-3' }],
    [{ skill: 'Fine', opensOn: '2026-02-30' }],
    [{ skill: 'Fine', opensOn: '' }],
  ])('rejects %j', async (input) => {
    const { setWeek, EditorError } = await import('@/lib/db/teacher');
    await expect(setWeek(PLAN.weeks.open.id, input)).rejects.toBeInstanceOf(EditorError);
    const [w] = await sql`select skill from wp_weeks where id = ${PLAN.weeks.open.id}`;
    expect(w.skill).toBe('Past tense, again');
  });

  it('accepts 60 characters and reports an unknown week', async () => {
    const { setWeek } = await import('@/lib/db/teacher');
    const { NotFoundError } = await import('@/lib/db/kid');
    await setWeek(PLAN.weeks.open.id, { skill: 'y'.repeat(60), opensOn: '2026-01-01' });
    await expect(setWeek('00000000-0000-4000-8000-00000000ffff', { skill: 'a', opensOn: '2026-01-01' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('listPlans and getEditorLesson', () => {
  it('lists each class with its plan, weeks (with weekday) and lessons', async () => {
    const { listPlans } = await import('@/lib/db/teacher');
    const classes = await listPlans();
    const g1 = classes.find((c) => c.id === CLASS.id)!;
    const plan = g1.plans.find((p) => p.id === PLAN.id)!;
    expect(plan.weeks.map((w) => w.id)).toEqual([PLAN.weeks.open.id, PLAN.weeks.locked.id, PLAN.weeks.later.id, PLAN.weeks.final.id]);
    expect(plan.weeks[2].opensOn).toBe('2099-01-01');
    expect(plan.weeks[0].lessons.map((l) => l.id)).toEqual([PLAN.lessons.one.id, PLAN.lessons.two.id]);
  });

  it('the editor lists only non-deleted questions, in order', async () => {
    const { getEditorLesson } = await import('@/lib/db/teacher');
    const d = (await getEditorLesson(LESSON))!;
    expect(d.questions.map((q) => q.position)).toEqual([...d.questions.map((q) => q.position)].sort((a, b) => a - b));
    expect(d.questions.every((q) => q.question?.type)).toBe(true);
    expect(await getEditorLesson('nope')).toBeNull();
  });
});

describe('Review Focus 4: deleting or editing a question kids already answered', () => {
  const LESSON2 = PLAN.lessons.two.id;
  const Q3 = PLAN.questions.q3.id;
  const Q4 = PLAN.questions.q4.id;
  const MINA = STUDENTS.mina.id;

  it('softDeleteQuestion sets deleted_at and never removes the row', async () => {
    const { softDeleteQuestion } = await import('@/lib/db/teacher');
    await sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context)
      values (${MINA}, ${Q3}, '00000000-0000-4000-8000-00000000b101', false, 'lesson')`;
    await softDeleteQuestion(Q3);
    const [row] = await sql`select deleted_at from wp_questions where id = ${Q3}`;
    expect(row.deleted_at).not.toBeNull();
    await softDeleteQuestion(Q3); // twice is fine
    await expect(softDeleteQuestion('00000000-0000-4000-8000-00000000ffff')).rejects.toThrow();
  });

  it('the lesson player data skips it, and the half-done lesson still finishes', async () => {
    const { getLesson, completeLesson, recordAttempt } = await import('@/lib/db/kid');
    const data = await getLesson(MINA, LESSON2, NOW);
    expect(data.questions.map((q) => q.id)).toEqual([Q4]);
    // a kid who still has the old page open answers the deleted question, then the other, then finishes
    await expect(recordAttempt(MINA, { clientAttemptId: '00000000-0000-4000-8000-00000000b102', questionId: Q3, correct: true, context: 'lesson' }, NOW)).resolves.toBeTruthy();
    await recordAttempt(MINA, { clientAttemptId: '00000000-0000-4000-8000-00000000b103', questionId: Q4, correct: true, context: 'lesson' }, NOW);
    const done = await completeLesson(MINA, LESSON2, NOW);
    expect(done.starsAwarded).toBeGreaterThanOrEqual(10);
  });

  it('free practice and missed-question practice never return it', async () => {
    const { getPracticeSet, getMissedIds } = await import('@/lib/db/kid');
    // Mina's latest attempt on Q3 was wrong earlier, then right; make the old wrong one the latest to prove the delete hides it
    await sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context, created_at)
      values (${MINA}, ${Q3}, '00000000-0000-4000-8000-00000000b104', false, 'free', now() + interval '1 hour')`;
    expect((await getMissedIds(MINA)).has(Q3)).toBe(false);
    for (let i = 0; i < 20; i++) {
      const set = await getPracticeSet(MINA, NOW, 8, () => (i + 1) / 21);
      expect(set.map((q) => q.id)).not.toContain(Q3);
    }
  });

  it('teacher stats still count the old attempt', async () => {
    const { classStats, studentDetail } = await import('@/lib/db/teacher');
    const row = (await classStats(CLASS.id))!.rows.find((r) => r.studentId === MINA)!;
    expect(row.lastSkill).not.toBeNull();
    const detail = (await studentDetail(MINA))!;
    expect(detail.history.length).toBeGreaterThan(0);
    const [{ n }] = await sql`select count(*)::int as n from wp_attempts where question_id = ${Q3}`;
    expect(n).toBe(3);
  });

  it('the editor list no longer shows it', async () => {
    const { getEditorLesson } = await import('@/lib/db/teacher');
    const d = (await getEditorLesson(LESSON2))!;
    expect(d.questions.map((q) => q.id)).toEqual([Q4]);
  });
});
