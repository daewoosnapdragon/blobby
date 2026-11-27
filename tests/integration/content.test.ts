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

describe('skills and the review bank', () => {
  const tagged = () => {
    const b = base();
    b.plan.title = 'Skill test';
    (b.weeks[0].lessons[0].questions[0] as Record<string, unknown>).skill = 'plurals';
    return b;
  };

  it('importContent stores each question skill, and a re-import fills it in without touching edits', async () => {
    const c = parseContent(tagged());
    await importContent(sql, c);
    const rows = await sql`select q.position, q.skill from wp_questions q join wp_lessons l on l.id = q.lesson_id join wp_weeks w on w.id = l.week_id join wp_plans p on p.id = w.plan_id where p.title = 'Skill test' and l.position = 1 order by q.position`;
    expect(rows.map((r) => r.skill)).toEqual(['plurals', null]);
    await sql`update wp_questions set skill = null, payload = payload || '{"prompt":"Edited."}'::jsonb where skill = 'plurals'`;
    await importContent(sql, c);
    const [q] = await sql`select q.skill, q.payload->>'prompt' as prompt from wp_questions q join wp_lessons l on l.id = q.lesson_id join wp_weeks w on w.id = l.week_id join wp_plans p on p.id = w.plan_id where p.title = 'Skill test' and l.position = 1 and q.position = 1`;
    expect(q).toEqual({ skill: 'plurals', prompt: 'Edited.' });
  });

  it('contentToSql loads skills and is safe to run twice', async () => {
    const { contentToSql } = await import('@/lib/contentSql');
    const b = tagged(); b.plan.title = 'SQL skill test';
    const text = contentToSql(parseContent(b));
    await sql.unsafe(text);
    await sql.unsafe(text);
    const rows = await sql`select q.skill from wp_questions q join wp_lessons l on l.id = q.lesson_id join wp_weeks w on w.id = l.week_id join wp_plans p on p.id = w.plan_id where p.title = 'SQL skill test' order by l.position, q.position`;
    expect(rows.map((r) => r.skill)).toEqual(['plurals', null, null]);
  });

  it('bankToSql adds bank questions once, by grade and skill', async () => {
    const { bankToSql } = await import('@/lib/contentSql');
    const { parseBank } = await import('@/lib/bank');
    const pick = { type: 'pick_one', prompt: 'Pick.', choices: ['went', 'goed'], answer: 0 };
    const text = bankToSql(parseBank({ grade: 3, skills: { 'past-tense': [pick, { ...pick, prompt: 'Again.' }] } }));
    await sql.unsafe(text);
    await sql.unsafe(text);
    const rows = await sql`select bank_grade, skill, position, lesson_id from wp_questions where bank_grade is not null order by position`;
    expect(rows).toEqual([
      { bank_grade: 3, skill: 'past-tense', position: 1, lesson_id: null },
      { bank_grade: 3, skill: 'past-tense', position: 2, lesson_id: null },
    ]);
  });
});

describe('update mode SQL (PART 1 look, PART 2 apply)', () => {
  const pq = (n: number, prompt = `Q${n}?`) => ({ type: 'pick_one', prompt, choices: ['a', 'b'], answer: 0 });
  const planFile = (prompts: Record<number, string> = {}, n = 9) => parseContent({
    plan: { title: 'Update test', kind: 'test' },
    assignTo: { grade: 3 },
    weeks: [{ skill: 'Plurals', opensOn: '2026-01-05', lessons: [
      { title: 'U1', questions: Array.from({ length: n }, (_, i) => ({ ...pq(i + 1, prompts[i + 1]), ...(i === 0 ? { skill: 'plurals' } : {}) })) },
    ] }],
  });
  const part1 = (text: string) => text.slice(0, text.indexOf('-- >>> PART 2 STARTS HERE <<<'));
  const part2 = (text: string) => text.slice(text.indexOf('-- >>> PART 2 STARTS HERE <<<'));
  const rows = () => sql`select q.id, q.position, q.payload->>'prompt' as prompt, q.skill, q.deleted_at, q.updated_at
    from wp_questions q join wp_lessons l on l.id = q.lesson_id join wp_weeks w on w.id = l.week_id join wp_plans p on p.id = w.plan_id
    where p.title = 'Update test' order by q.position, q.id`;
  let contentToSql: typeof import('@/lib/contentSql').contentToSql;
  let bankToSql: typeof import('@/lib/contentSql').bankToSql;
  let parseBank: typeof import('@/lib/bank').parseBank;

  beforeAll(async () => {
    ({ contentToSql, bankToSql } = await import('@/lib/contentSql'));
    ({ parseBank } = await import('@/lib/bank'));
    await sql.unsafe(contentToSql(planFile())); // the base, loaded add-only as before this pass
  });

  it('PART 1 only reads, and lists nothing when the app matches the base', async () => {
    const before = await rows();
    const text = contentToSql(planFile({ 2: 'Changed two?' }), { update: true, base: planFile() });
    expect(await sql.unsafe(part1(text))).toEqual([]);
    expect(await rows()).toEqual(before);
  });

  it('PART 1 without a base lists every existing row PART 2 would touch', async () => {
    const text = contentToSql(planFile({}, 10), { update: true });
    const listed = await sql.unsafe(part1(text));
    expect(listed.map((r) => r.question_position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(listed[0]).toMatchObject({ week_position: 1, lesson_title: 'U1', file_text: null });
    expect(listed[0].app_text).toContain('Q1?');
  });

  it('PART 1 lists exactly the row the teacher edited in the app', async () => {
    await sql`update wp_questions set payload = payload || '{"prompt":"Teacher three?"}'::jsonb, updated_at = now()
      where payload->>'prompt' = 'Q3?'`;
    const text = contentToSql(planFile({ 2: 'Changed two?' }, 10), { update: true, base: planFile() });
    const listed = await sql.unsafe(part1(text));
    expect(listed.length).toBe(1);
    expect(listed[0]).toMatchObject({ week_position: 1, lesson_title: 'U1', question_position: 3 });
    expect(listed[0].app_text).toContain('Teacher three?');
    expect(listed[0].file_text).toContain('Q3?');
  });

  it('PART 1 lists an edit to the last choice with the whole question text', async () => {
    // jsonb puts short keys first ("answer", "prompt", "choices"), so the last choice is near the end of the text
    await sql`update wp_questions set payload = jsonb_set(payload, '{choices,1}', '"Teacher last choice"')
      where payload->>'prompt' = 'Q4?'`;
    const text = contentToSql(planFile({ 2: 'Changed two?' }, 10), { update: true, base: planFile() });
    const listed = await sql.unsafe(part1(text));
    expect(listed.map((r) => r.question_position)).toEqual([3, 4]);
    const row = listed[1];
    expect(row).toMatchObject({ week_position: 1, lesson_title: 'U1', question_position: 4 });
    expect(row.app_text).toContain('Teacher last choice');
    expect(row.file_text).not.toContain('Teacher last choice');
    expect(row.file_text).toContain('"b"');
    expect(row.app_text).not.toBe(row.file_text);
    expect(JSON.parse(row.app_text)).toEqual({ prompt: 'Q4?', choices: ['a', 'Teacher last choice'], answer: 0 });
    expect(JSON.parse(row.file_text)).toEqual({ prompt: 'Q4?', choices: ['a', 'b'], answer: 0 });
  });

  it('PART 2 updates in place, inserts missing positions, keeps a deleted position deleted, and a second run changes nothing', async () => {
    await sql`update wp_questions set deleted_at = now() where payload->>'prompt' = 'Q7?'`;
    const before = await rows();
    const byPos = (rs: typeof before, p: number) => rs.filter((r) => r.position === p);
    const next = planFile({ 2: 'Changed two?', 7: 'Changed seven?', 8: 'Changed eight?', 10: 'Brand new ten?' }, 10);
    const text = contentToSql(next, { update: true, base: planFile() });
    await new Promise((r) => setTimeout(r, 10));
    await sql.unsafe(part2(text));
    const after = await rows();
    expect(after.length).toBe(10);
    expect(byPos(after, 2)[0]).toMatchObject({ id: byPos(before, 2)[0].id, prompt: 'Changed two?' });
    expect(byPos(after, 2)[0].updated_at.getTime()).toBeGreaterThan(byPos(before, 2)[0].updated_at.getTime());
    expect(byPos(after, 3)[0]).toMatchObject({ id: byPos(before, 3)[0].id, prompt: 'Q3?' }); // the file wins in update mode
    // Review Focus 3: the teacher-deleted position 7 is neither revived, edited nor re-inserted ...
    expect(byPos(after, 7)).toEqual(byPos(before, 7));
    expect(byPos(after, 7)[0].deleted_at).not.toBeNull();
    // ... and the positions after it are still updated and inserted
    expect(byPos(after, 8)[0]).toMatchObject({ id: byPos(before, 8)[0].id, prompt: 'Changed eight?' });
    expect(byPos(after, 10)).toHaveLength(1);
    expect(byPos(after, 10)[0]).toMatchObject({ prompt: 'Brand new ten?', deleted_at: null, skill: null });
    // untouched rows keep their updated_at
    expect(byPos(after, 5)).toEqual(byPos(before, 5));
    expect(byPos(after, 1)[0].skill).toBe('plurals');

    await new Promise((r) => setTimeout(r, 10));
    await sql.unsafe(text.slice(text.indexOf('-- >>> PART 2 STARTS HERE <<<'))); // second run
    expect(await rows()).toEqual(after);
    // and running the whole file (PART 1 + PART 2) also changes nothing
    await sql.unsafe(text);
    expect(await rows()).toEqual(after);
  });

  it('PART 2 changes the skill tag when only the skill differs', async () => {
    const f = planFile({ 2: 'Changed two?', 7: 'Changed seven?', 8: 'Changed eight?', 10: 'Brand new ten?' }, 10);
    f.weeks[0].lessons[0].skills[1] = 'articles';
    await sql.unsafe(part2(contentToSql(f, { update: true })));
    const r = (await rows()).find((x) => x.position === 2)!;
    expect(r.skill).toBe('articles');
  });

  describe('banks, by (bank_grade, skill, position)', () => {
    const bq = (prompt: string) => ({ type: 'pick_one', prompt, choices: ['went', 'goed'], answer: 0 });
    const bankFile = (prompts: string[]) => parseBank({ grade: 4, skills: { 'irregular-past': prompts.map(bq), 'was-were': [bq('Was?')] } });
    const baseBank = () => bankFile(['B1?', 'B2?', 'B3?']);
    const bankRows = () => sql`select id, skill, position, payload->>'prompt' as prompt, deleted_at, updated_at
      from wp_questions where bank_grade = 4 order by skill, position, id`;

    beforeAll(async () => { await sql.unsafe(bankToSql(baseBank())); });

    it('PART 1 lists nothing against an equal base, and exactly the in-app edit after one', async () => {
      const text = () => bankToSql(bankFile(['New one?', 'New two?', 'B3?', 'New four?']), { update: true, base: baseBank() });
      expect(await sql.unsafe(part1(text()))).toEqual([]);
      await sql`update wp_questions set payload = payload || '{"prompt":"Teacher B3?"}'::jsonb where bank_grade = 4 and payload->>'prompt' = 'B3?'`;
      const listed = await sql.unsafe(part1(text()));
      expect(listed.length).toBe(1);
      expect(listed[0]).toMatchObject({ skill: 'irregular-past', question_position: 3 });
      expect(listed[0].app_text).toContain('Teacher B3?');
      expect(listed[0].file_text).toContain('B3?');
      // an edit to the last choice is listed too, with the whole text
      await sql`update wp_questions set payload = jsonb_set(payload, '{choices,1}', '"Teacher goed"') where bank_grade = 4 and payload->>'prompt' = 'B1?'`;
      const both = await sql.unsafe(part1(text()));
      expect(both.map((r) => [r.skill, r.question_position])).toEqual([['irregular-past', 1], ['irregular-past', 3]]);
      expect(both[0].app_text).toContain('Teacher goed');
      expect(both[0].file_text).not.toContain('Teacher goed');
      expect(both[0].app_text).not.toBe(both[0].file_text);
      await sql`update wp_questions set payload = jsonb_set(payload, '{choices,1}', '"goed"') where bank_grade = 4 and payload->>'prompt' = 'B1?'`;
      // without a base, every existing row is listed
      expect((await sql.unsafe(part1(bankToSql(bankFile(['x?']), { update: true })))).length).toBe(2);
    });

    it('PART 2 updates in place, inserts missing, keeps deleted positions deleted, and is idempotent', async () => {
      await sql`update wp_questions set deleted_at = now() where bank_grade = 4 and payload->>'prompt' = 'B2?'`;
      const before = await bankRows();
      const at = (rs: typeof before, s: string, p: number) => rs.filter((r) => r.skill === s && r.position === p);
      const text = bankToSql(bankFile(['New one?', 'New two?', 'B3?', 'New four?']), { update: true, base: baseBank() });
      await new Promise((r) => setTimeout(r, 10));
      await sql.unsafe(part2(text));
      const after = await bankRows();
      expect(after.length).toBe(5);
      expect(at(after, 'irregular-past', 1)[0]).toMatchObject({ id: at(before, 'irregular-past', 1)[0].id, prompt: 'New one?' });
      expect(at(after, 'irregular-past', 2)).toEqual(at(before, 'irregular-past', 2)); // still deleted, untouched
      expect(at(after, 'irregular-past', 3)[0]).toMatchObject({ id: at(before, 'irregular-past', 3)[0].id, prompt: 'B3?' });
      expect(at(after, 'irregular-past', 4)[0]).toMatchObject({ prompt: 'New four?', deleted_at: null });
      expect(at(after, 'was-were', 1)).toEqual(at(before, 'was-were', 1));
      await new Promise((r) => setTimeout(r, 10));
      await sql.unsafe(part2(text));
      expect(await bankRows()).toEqual(after);
    });
  });
});
