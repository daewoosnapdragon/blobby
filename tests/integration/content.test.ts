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
    // default: the app's version wins (R37)
    const kept = await importContent(sql, parseContent(b));
    expect(kept.differing).toBe(1);
    const [same] = await sql`select payload from wp_questions where id = ${orig.id}`;
    expect(same.payload.prompt).toBe('Pick the plural.');
    // --overwrite: the file wins
    const over = await importContent(sql, parseContent(b), { overwrite: true });
    expect(over.differing).toBe(0);
    expect(await count('wp_questions')).toBe(3);
    const [q] = await sql`select payload, audio from wp_questions where id = ${orig.id}`;
    expect(q.payload.prompt).toBe('Pick the plural of cat.');
    expect(q.audio).toEqual({ 'Pick the plural.': 'u' }); // refreshed by the audio step, not the DB step
  });

  it('never overwrites a teacher edit by default, but still inserts new positions', async () => {
    const [orig] = await sql`select id from wp_questions where position = 1 and type = 'pick_one' and deleted_at is null order by id limit 1`;
    await sql`update wp_questions set payload = ${sql.json({ prompt: 'Teacher wrote this.', choices: ['x', 'y'], answer: 1 })} where id = ${orig.id}`;
    const b = base();
    b.weeks[0].lessons[1].questions.push({ type: 'pick_one', prompt: 'Brand new?', choices: ['a', 'b'], answer: 0 });
    const r = await importContent(sql, parseContent(b));
    expect(r.differing).toBeGreaterThanOrEqual(1);
    const [q] = await sql`select payload from wp_questions where id = ${orig.id}`;
    expect(q.payload.prompt).toBe('Teacher wrote this.');
    expect((await sql`select 1 from wp_questions where payload->>'prompt' = 'Brand new?'`).length).toBe(1);
    // restore for the tests below
    await importContent(sql, parseContent(base()), { overwrite: true });
    await sql`delete from wp_questions where payload->>'prompt' = 'Brand new?'`;
  });

  it('keeps a question the teacher deleted deleted by default, and revives it only with --overwrite', async () => {
    await sql`update wp_questions set deleted_at = now() where position = 2 and type = 'build_it'`;
    const kept = await importContent(sql, parseContent(base()));
    expect(kept.keptDeleted).toBe(1);
    expect(kept.questions).toBe(2);
    expect(await count('wp_questions')).toBe(3);
    expect((await sql`select 1 from wp_questions where type = 'build_it' and deleted_at is null`).length).toBe(0);
    // a second default import still leaves it deleted
    expect((await importContent(sql, parseContent(base()))).keptDeleted).toBe(1);
    expect(await count('wp_questions')).toBe(3);
    // --overwrite: the file wins, a fresh row is inserted at that position
    const over = await importContent(sql, parseContent(base()), { overwrite: true });
    expect(over.keptDeleted).toBe(0);
    expect(await count('wp_questions')).toBe(4);
    expect((await sql`select 1 from wp_questions where type = 'build_it' and deleted_at is null`).length).toBe(1);
  });

  it('keeps the teacher\'s week skill, opens_on and lesson titles by default; --overwrite restores the file', async () => {
    await sql`update wp_weeks set skill = 'Plural nouns (teacher)', opens_on = '2026-01-07'`;
    await sql`update wp_lessons set title = 'Lesson one (teacher)' where position = 1`;
    const kept = await importContent(sql, parseContent(base()));
    expect(kept).toMatchObject({ keptWeeks: 1, keptLessons: 1, differing: 0, keptDeleted: 0 });
    const [w] = await sql`select skill, opens_on from wp_weeks`;
    expect(w).toEqual({ skill: 'Plural nouns (teacher)', opens_on: '2026-01-07' });
    const [l] = await sql`select title from wp_lessons where position = 1`;
    expect(l.title).toBe('Lesson one (teacher)');
    // only one of skill/opens_on differing still counts the week once
    await sql`update wp_weeks set opens_on = '2026-01-05'`;
    expect((await importContent(sql, parseContent(base()))).keptWeeks).toBe(1);

    const over = await importContent(sql, parseContent(base()), { overwrite: true });
    expect(over).toMatchObject({ keptWeeks: 0, keptLessons: 0 });
    const [w2] = await sql`select skill, opens_on from wp_weeks`;
    expect(w2).toEqual({ skill: 'Plurals', opens_on: '2026-01-05' });
    const [l2] = await sql`select title from wp_lessons where position = 1`;
    expect(l2.title).toBe('One');
    // matching values: nothing counted
    expect(await importContent(sql, parseContent(base()))).toMatchObject({ keptWeeks: 0, keptLessons: 0, differing: 0, keptDeleted: 0 });
  });

  it('writes nothing when validation fails', async () => {
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
