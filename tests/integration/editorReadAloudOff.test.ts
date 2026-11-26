import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, seedPlan, PLAN } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

// Read-aloud is switched off in the app for now (src/lib/features.ts): saving must not touch the voice service.
let sql: Awaited<ReturnType<typeof resetTestDb>>;
beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await seedPlan(sql);
});
afterAll(async () => { await sql.end(); });

const LESSON = PLAN.lessons.one.id;
const pick = (prompt: string) => ({ prompt, choices: ['I walk.', 'I walked.'], answer: 1 });

describe('saveQuestion with read-aloud off', () => {
  it('saves without making audio, reports ok, and the editor flags nothing as missing', async () => {
    const { saveQuestion, getEditorLesson } = await import('@/lib/db/teacher');
    const synthesize = vi.fn(async () => Buffer.from('mp3'));
    const deps = vi.fn(async () => ({
      voice: 'v', synthesize,
      storage: { exists: async () => false, upload: async () => {}, publicUrl: () => 'x' },
    }));
    const r = await saveQuestion(LESSON, {}, 'pick_one', pick('No sound needed?'), { audio: deps });
    expect(r.audio).toBe('ok');
    expect(deps).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
    const [row] = await sql<{ audio: unknown; payload: { prompt: string } }[]>`select audio, payload from wp_questions where id = ${r.id}`;
    expect(row.payload.prompt).toBe('No sound needed?');
    expect(row.audio).toEqual({});
    const listed = (await getEditorLesson(LESSON))!.questions;
    expect(listed.some((q) => q.audioMissing)).toBe(false);
  });

  it('needs no voice service keys at all', async () => {
    const { saveQuestion } = await import('@/lib/db/teacher');
    const saved = { openai: process.env.OPENAI_API_KEY, url: process.env.SUPABASE_URL };
    delete process.env.OPENAI_API_KEY;
    delete process.env.SUPABASE_URL;
    try {
      const r = await saveQuestion(LESSON, {}, 'pick_one', pick('Still saves?'));
      expect(r.audio).toBe('ok');
    } finally {
      if (saved.openai !== undefined) process.env.OPENAI_API_KEY = saved.openai;
      if (saved.url !== undefined) process.env.SUPABASE_URL = saved.url;
    }
  });
});
