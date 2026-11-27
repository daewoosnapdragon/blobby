import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PROMPT_POOLS } from '@/lib/contentPass';

// The shape the content pass leaves the eight real content files in (spec: the content pass, Nov 26).
type Q = { type: string; prompt?: string; picture?: string; questions?: Q[] } & Record<string, unknown>;
const root = path.resolve(__dirname, '../..');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, 'content', f), 'utf8'));
const GRADES = [1, 2, 3, 4];
const plans = GRADES.map((g) => ({ file: `test-week-g${g}.json`, data: read(`test-week-g${g}.json`) as { weeks: { lessons: { title: string; questions: Q[] }[] }[] } }));
const banks = GRADES.map((g) => ({ file: `review-bank-g${g}.json`, data: read(`review-bank-g${g}.json`) as { skills: Record<string, Q[]> } }));
const lessons = plans.flatMap(({ file, data }) => data.weeks.flatMap((w) => w.lessons.map((l) => ({ where: `${file} "${l.title}"`, questions: l.questions }))));
const skills = banks.flatMap(({ file, data }) => Object.entries(data.skills).map(([key, questions]) => ({ where: `${file} ${key}`, questions })));
const all = [...lessons, ...skills].flatMap(({ where, questions }) =>
  questions.flatMap((q, i) => [{ where: `${where} Q${i + 1}`, q }, ...(q.questions ?? []).map((sub, j) => ({ where: `${where} Q${i + 1}.${j + 1}`, q: sub }))]));
const NEW_TYPES = new Set(['right_wrong', 'odd_one_out', 'picture_first', 'tap_all', 'match_pairs']);

describe('content shape after the content pass', () => {
  it('reads all eight files: 20 lessons and 39 bank skills', () => {
    expect(lessons).toHaveLength(20);
    expect(skills).toHaveLength(39);
  });

  it('every test-week lesson has 15 questions, every bank skill 11', () => {
    expect(lessons.filter((l) => l.questions.length !== 15).map((l) => l.where)).toEqual([]);
    expect(skills.filter((s) => s.questions.length !== 11).map((s) => s.where)).toEqual([]);
  });

  it('lesson positions 13 to 15 are three different new types, at most one yes or no', () => {
    for (const { where, questions } of lessons) {
      const types = questions.slice(12, 15).map((q) => q.type);
      expect(types.every((t) => NEW_TYPES.has(t)), `${where}: ${types.join(', ')}`).toBe(true);
      expect(new Set(types).size, `${where}: ${types.join(', ')}`).toBe(3);
      expect(types.filter((t) => t === 'right_wrong').length, where).toBeLessThanOrEqual(1);
    }
  });

  it('bank position 11 is a new type', () => {
    expect(skills.filter((s) => !NEW_TYPES.has(s.questions[10]?.type)).map((s) => `${s.where}: ${s.questions[10]?.type}`)).toEqual([]);
  });

  it('every picture_first picture exists in public/pictures', () => {
    const missing = all.filter(({ q }) => q.type === 'picture_first' && !fs.existsSync(path.join(root, 'public/pictures', `${q.picture}.svg`)));
    expect(missing.map((m) => `${m.where}: ${m.q.picture}`)).toEqual([]);
  });

  it('no bank question has a picture', () => {
    expect(skills.flatMap(({ where, questions }) => questions.flatMap((q, i) => (q.picture ? [`${where} Q${i + 1}`] : [])))).toEqual([]);
  });

  it('no stock prompt is left that is not also in its pool', () => {
    const stale = all.filter(({ q }) => PROMPT_POOLS.some((p) => p.type === q.type && p.stock.includes(q.prompt ?? '') && !p.pool.includes(q.prompt ?? '')));
    expect(stale.map((s) => `${s.where}: ${s.q.prompt}`)).toEqual([]);
  });

  it('no prompt says "wrong"', () => {
    expect(all.filter(({ q }) => /\bwrong\b/i.test(q.prompt ?? '')).map((s) => `${s.where}: ${s.q.prompt}`)).toEqual([]);
  });

  it('no old cast name is left anywhere', () => {
    const old = /\b(Mia|Mina|Stella|Leo|Ben|Sam|Jun|Tom)(s|'s|s')?\b/gi;
    for (const { file } of [...plans, ...banks]) {
      const text = fs.readFileSync(path.join(root, 'content', file), 'utf8');
      expect(text.match(old) ?? [], file).toEqual([]);
    }
  });
});
