import { describe, it, expect } from 'vitest';
import { parseContent } from '@/lib/content';
import { parseBank } from '@/lib/bank';
import { bankToSql, contentToSql } from '@/lib/contentSql';

const pick = { type: 'pick_one', prompt: "Pick Nova's one.", choices: ['A', 'B'], answer: 0 };
const plan = () => parseContent({
  plan: { title: 'P', kind: 'test' },
  assignTo: { grade: 3 },
  weeks: [{ skill: 'S', opensOn: '2026-01-01', lessons: [{ title: 'L1', questions: [pick, { ...pick, prompt: 'Two.' }] }] }],
});
const bank = () => parseBank({ grade: 2, skills: { 'past-tense': [pick] } });

const split = (text: string) => {
  const i = text.indexOf('PART 2: APPLY');
  return { part1: text.slice(text.indexOf('PART 1: LOOK FIRST'), i), part2: text.slice(i) };
};
// statements only: drop comment lines so words in the header don't count
const code = (s: string) => s.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

describe.each([
  ['contentToSql', () => contentToSql(plan(), { update: true, base: plan() })],
  ['contentToSql without base', () => contentToSql(plan(), { update: true })],
  ['bankToSql', () => bankToSql(bank(), { update: true, base: bank() })],
  ['bankToSql without base', () => bankToSql(bank(), { update: true })],
])('%s update mode', (_name, make) => {
  it('has a header, a read-only PART 1 and a PART 2 in one transaction', () => {
    const text = make();
    expect(text.startsWith('-- ====')).toBe(true);
    expect(text).toMatch(/What this does:/);
    expect(text).toMatch(/What it keeps:/);
    expect(text).toMatch(/How to use:/);
    expect(text).toMatch(/twice/);
    expect(text).toContain('-- PART 1 compares the question text (payload) only; a change to only the type or\n-- the skill tag is applied by PART 2 without being listed.');
    expect(text.indexOf('PART 1: LOOK FIRST')).toBeGreaterThan(0);
    expect(text.indexOf('PART 2: APPLY')).toBeGreaterThan(text.indexOf('PART 1: LOOK FIRST'));
    const { part1, part2 } = split(text);
    expect(code(part1)).toMatch(/\bselect\b/);
    expect(code(part1)).not.toMatch(/\b(update|insert|delete|begin|commit)\b/i);
    expect(code(part2)).toMatch(/^begin;$/m);
    expect(code(part2).trimEnd().endsWith('commit;')).toBe(true);
    expect(code(part2)).toMatch(/update wp_questions set type = /);
    expect(code(part2)).toMatch(/updated_at = now\(\)/);
    expect(code(part2)).toMatch(/deleted_at is null/);
  });
});

describe('add-only mode is unchanged', () => {
  it('contentToSql without update has no PART markers or transaction', () => {
    for (const text of [contentToSql(plan()), contentToSql(plan(), { update: false, base: plan() })]) {
      expect(text.startsWith('-- P\n')).toBe(true);
      expect(text).not.toMatch(/PART [12]|begin;|commit;|updated_at/);
    }
    expect(contentToSql(plan(), {})).toBe(contentToSql(plan()));
  });
  it('bankToSql without update has no PART markers or transaction', () => {
    const text = bankToSql(bank());
    expect(text.startsWith('-- Review bank, grade 2: 1 questions\n')).toBe(true);
    expect(text).not.toMatch(/PART [12]|begin;|commit;|updated_at/);
  });
});

describe('quoting', () => {
  it("escapes apostrophes in payloads and the base's text", () => {
    const text = contentToSql(plan(), { update: true, base: plan() });
    expect(text).toContain("Nova''s one.");
    expect(text).not.toMatch(/[^']Nova's/);
  });
});
