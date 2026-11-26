import { describe, it, expect } from 'vitest';
import { RIGHT_LINES, ALMOST_LINES, ROLL3_LINES, ROLL5_LINES, titlePool, pickLine, answerLine } from '@/lib/feedbackLines';

describe('feedbackLines', () => {
  it('pools hold the agreed lines', () => {
    expect(RIGHT_LINES).toHaveLength(12);
    expect(RIGHT_LINES[0]).toBe('That’s it!');
    expect(ALMOST_LINES).toHaveLength(12);
    expect(ALMOST_LINES[0]).toBe('Almost!');
    expect(ROLL3_LINES).toHaveLength(5);
    expect(ROLL5_LINES).toHaveLength(5);
    for (const l of [...RIGHT_LINES, ...ALMOST_LINES, ...ROLL3_LINES, ...ROLL5_LINES]) expect(l).not.toMatch(/wrong/i);
  });
  it('titlePool picks by result and roll', () => {
    expect(titlePool(true, 3)).toBe(ROLL3_LINES);
    expect(titlePool(true, 5)).toBe(ROLL5_LINES);
    expect(titlePool(true, 4)).toBe(RIGHT_LINES);
    expect(titlePool(false, 3)).toBe(ALMOST_LINES);
  });
  it('pickLine never repeats the last line', () => {
    const pool = ['a', 'b'];
    for (let i = 0; i < 20; i++) expect(pickLine(pool, 'a', Math.random)).toBe('b');
    expect(pickLine(['only'], 'only')).toBe('only');
  });
  it('answerLine names the answer for fill_blank and find_fix only', () => {
    expect(answerLine({ type: 'fill_blank', before: 'We', after: 'pizza.', choices: ['eat', 'ate'], answer: 1 })).toBe('“ate” fits!');
    expect(answerLine({ type: 'find_fix', words: ['She', 'goed', 'home.'], wrongIndex: 1, fixes: ['went', 'gone'], answer: 0 })).toBe('went, not goed!');
    expect(answerLine({ type: 'pick_one', prompt: 'p', choices: ['a', 'b'], answer: 0 })).toBeNull();
  });
  it('answerLine strips punctuation the words and choices carry', () => {
    expect(answerLine({ type: 'find_fix', words: ['I', 'want', 'an', 'umbrella.'], wrongIndex: 3, fixes: ['an umbrella.', 'a umbrella.'], answer: 0 }))
      .toBe('an umbrella, not umbrella!');
    expect(answerLine({ type: 'fill_blank', before: '', after: 'we ran inside.', choices: ['When it started to rain,', 'Rain'], answer: 0 }))
      .toBe('“When it started to rain” fits!');
  });
  it('answerLine gives no line for a punctuation- or capitalization-only fix', () => {
    expect(answerLine({ type: 'find_fix', words: ['I', 'saw', 'ben.'], wrongIndex: 2, fixes: ['Ben.', 'Ben!'], answer: 0 })).toBeNull();
    expect(answerLine({ type: 'find_fix', words: ['We', 'went', 'to', 'the', 'zoo!'], wrongIndex: 4, fixes: ['zoo.', 'zoo?'], answer: 0 })).toBeNull();
    expect(answerLine({ type: 'find_fix', words: ['It', 'rained', 'so,'], wrongIndex: 2, fixes: ['so', 'too'], answer: 0 })).toBeNull();
  });
});
