import { describe, it, expect } from 'vitest';
import { parseContent } from '@/lib/content';
import sample from '../../content/test-plan.json';

const pick = { type: 'pick_one', prompt: 'Pick one.', choices: ['A', 'B'], answer: 0 };
const file = (qs: unknown[]) => ({
  plan: { title: 'P', kind: 'test' },
  assignTo: { grade: 3 },
  weeks: [{ skill: 'S', opensOn: '2026-01-01', lessons: [{ title: 'L1', questions: [pick] }, { title: 'L2', questions: qs }] }],
});

describe('parseContent', () => {
  it('accepts the sample test plan', () => {
    const c = parseContent(sample);
    expect(c.plan.kind).toBe('test');
    expect(c.weeks[0].lessons.length).toBe(2);
    expect(c.weeks.flatMap((w) => w.lessons).flatMap((l) => l.questions).length).toBeGreaterThanOrEqual(6);
  });

  it('names week, lesson and 1-based question position for a bad question', () => {
    expect(() => parseContent(file([pick, { type: 'pick_one', prompt: 'x', choices: ['A', 'B'], answer: 5 }]))).toThrow(
      /week 1, lesson 2, question 2:.*answer is out of range/,
    );
  });

  it('rejects an unknown type, a bad date and a bad kind', () => {
    expect(() => parseContent(file([{ type: 'nope' }]))).toThrow(/week 1, lesson 2, question 1: Unknown question type/);
    const bad = file([pick]); bad.weeks[0].opensOn = '01/02/2026';
    expect(() => parseContent(bad)).toThrow(/week 1.*opensOn/);
    const badKind = file([pick]); badKind.plan.kind = 'x';
    expect(() => parseContent(badKind)).toThrow(/plan\.kind/);
  });
});
