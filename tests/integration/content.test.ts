import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type postgres from 'postgres';
import { resetTestDb } from './helpers/db';
import { importContent, parseContent } from '@/lib/content';

let sql: ReturnType<typeof postgres>;
const base = () => ({
  plan: { title: 'Import test', kind: 'test' },
  assignTo: { grade: 3 },
  weeks: [{
    skill: 'Plurals', opensOn: '2026-01-05',
    lessons: [
      { title: 'One', questions: [
        { type: 'pick_one', prompt: 'Pick the plural.', choices: ['dogs', 'dog'], answer: 0 },
        { type: 'build_it', prompt: 'Build it.', tiles: ['I', 'run.'] },
      ] },
      { title: 'Two', questions: [{ type: 'pick_one', prompt: 'Second?', choices: ['a', 'b'], answer: 1 }] },
    ],
  }],
});
const count = async (t: string) => Number((await sql.unsafe(`select count(*)::int as n from ${t}`))[0].n);

beforeAll(async () => {
  sql = await resetTestDb();
  await sql`insert into wp_classes (grade, name, class_code) values (3, 'Snapdragon G3', 'AAA111'), (4, 'Snapdragon G4', 'BBB222')`;
});
afterAll(async () => { await sql.end(); });

describe('importContent', () => {
  it('imports, assigns once, and is idempotent', async () => {
    const c = parseContent(base());
    const r1 = await importContent(sql, c);
    expect(r1).toMatchObject({ weeks: 1, lessons: 2, questions: 3 });
    const before = await sql`select id, updated_at from wp_questions order by id`;
    await new Promise((r) => setTimeout(r, 10));
    await importContent(sql, c);
    expect(await count('wp_plans')).toBe(1);
    expect(await count('wp_weeks')).toBe(1);
    expect(await count('wp_lessons')).toBe(2);
    expect(await count('wp_questions')).toBe(3);
    expect(await count('wp_plan_assignments')).toBe(1);
    const after = await sql`select id, updated_at from wp_questions order by id`;
    expect(after).toEqual(before);
    const [a] = await sql`select c.grade from wp_plan_assignments a join wp_classes c on c.id = a.class_id`;
    expect(a.grade).toBe(3);
    const [w] = await sql`select opens_on from wp_weeks`;
    expect(w.opens_on).toBe('2026-01-05');
  });

  it('updates a changed question in place and keeps its id and audio', async () => {
    const [orig] = await sql`select id from wp_questions where position = 1 and type = 'pick_one' limit 1`;
    await sql`update wp_questions set audio = ${sql.json({ 'Pick the plural.': 'u' })} where id = ${orig.id}`;
    const b = base();
    b.weeks[0].lessons[0].questions[0] = { type: 'pick_one', prompt: 'Pick the plural of cat.', choices: ['cats', 'cat'], answer: 0 };
    await importContent(sql, parseContent(b));
    expect(await count('wp_questions')).toBe(3);
    const [q] = await sql`select payload, audio from wp_questions where id = ${orig.id}`;
    expect(q.payload.prompt).toBe('Pick the plural of cat.');
    expect(q.audio).toEqual({ 'Pick the plural.': 'u' }); // refreshed by the audio step, not the DB step
  });

  it('inserts fresh after a soft delete and writes nothing when validation fails', async () => {
    await sql`update wp_questions set deleted_at = now() where position = 2 and type = 'build_it'`;
    await importContent(sql, parseContent(base()));
    expect(await count('wp_questions')).toBe(4);
    const bad = base();
    bad.plan.title = 'Never written';
    (bad.weeks[0].lessons[1].questions[0] as { answer: number }).answer = 9;
    expect(() => parseContent(bad)).toThrow(/week 1, lesson 2, question 1/);
    expect(await count('wp_plans')).toBe(1);
  });

  it('fails when no class has that grade, writing nothing', async () => {
    const c = base(); c.plan.title = 'Orphan'; c.assignTo.grade = 1;
    await expect(importContent(sql, parseContent(c))).rejects.toThrow(/No class for grade 1/);
    expect(await count('wp_plans')).toBe(1);
  });
});
