import { describe, expect, it } from 'vitest';
import { parseBank } from '@/lib/bank';

const pick = { type: 'pick_one', prompt: 'Pick one.', choices: ['He went home.', 'He goed home.'], answer: 0 };

describe('parseBank', () => {
  it('reads a grade and its questions grouped by skill', () => {
    const b = parseBank({ grade: 3, skills: { 'past-tense': [pick, { ...pick, answer: 1, choices: ['He goed.', 'He went.'] }], 'articles': [pick] } });
    expect(b.grade).toBe(3);
    expect(b.questions.map((q) => [q.skill, q.position])).toEqual([['past-tense', 1], ['past-tense', 2], ['articles', 1]]);
    expect(b.questions[0].question.type).toBe('pick_one');
  });
  it('rejects an unknown skill, a bad grade, video questions and broken questions, naming where', () => {
    expect(() => parseBank({ grade: 3, skills: { magic: [pick] } })).toThrow(/unknown skill "magic"/);
    expect(() => parseBank({ grade: 7, skills: {} })).toThrow(/grade/);
    expect(() => parseBank({ grade: 3, skills: { 'past-tense': [{ type: 'watch_answer', youtubeId: 'dQw4w9WgXcQ', questions: [pick] }] } })).toThrow(/past-tense, question 1: .*video/);
    expect(() => parseBank({ grade: 3, skills: { 'past-tense': [{ ...pick, answer: 9 }] } })).toThrow(/past-tense, question 1/);
  });
});
