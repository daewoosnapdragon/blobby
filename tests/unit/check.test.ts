import { describe, it, expect } from 'vitest';
import { parseQuestion } from '@/lib/questions/schema';
import { checkAnswer } from '@/lib/questions/check';

const q = (type: any, payload: any) => parseQuestion(type, payload) as any;

describe('checkAnswer', () => {
  it('listen_tap', () => {
    const x = q('listen_tap', { prompt: 'Tap the word', audioText: 'bee', choices: [{ text: 'bee' }, { text: 'bed' }], answer: 0 });
    expect(checkAnswer(x, { choice: 0 })).toBe(true);
    expect(checkAnswer(x, { choice: 1 })).toBe(false);
  });
  it('pick_one', () => {
    const x = q('pick_one', { prompt: 'Which is right?', choices: ['He go.', 'He goes.'], answer: 1 });
    expect(checkAnswer(x, { choice: 1 })).toBe(true);
    expect(checkAnswer(x, { choice: 0 })).toBe(false);
  });
  it('fill_blank', () => {
    const x = q('fill_blank', { before: 'I', after: 'a cat.', choices: ['have', 'has'], answer: 0 });
    expect(checkAnswer(x, { choice: 0 })).toBe(true);
    expect(checkAnswer(x, { choice: 1 })).toBe(false);
  });
  it('find_fix: right fix after wrong tap is false', () => {
    const x = q('find_fix', { words: ['She', 'go', 'home'], wrongIndex: 1, fixes: ['goes', 'going'], answer: 0 });
    expect(checkAnswer(x, { tapped: 1, fix: 0 })).toBe(true);
    expect(checkAnswer(x, { tapped: 1, fix: 1 })).toBe(false);
    expect(checkAnswer(x, { tapped: 2, fix: 0 })).toBe(false);
  });
  it('build_it', () => {
    const x = q('build_it', { prompt: 'Build', tiles: ['I', 'like', 'cats'], distractors: ['likes', 'dog'] });
    expect(checkAnswer(x, { order: ['I', 'like', 'cats'] })).toBe(true);
    expect(checkAnswer(x, { order: ['like', 'I', 'cats'] })).toBe(false);
    expect(checkAnswer(x, { order: ['I', 'likes', 'cats'] })).toBe(false);
    expect(checkAnswer(x, { order: ['I', 'like'] })).toBe(false);
    expect(checkAnswer(x, { order: ['I', 'like', 'cats', 'dog'] })).toBe(false);
  });
  it('build_it ignores leftover distractors', () => {
    const x = q('build_it', { prompt: 'Build', tiles: ['A', 'B'], distractors: ['C'] });
    expect(checkAnswer(x, { order: ['A', 'B'] })).toBe(true);
  });
  it('sort_it', () => {
    const x = q('sort_it', { prompt: 'Sort', groups: ['noun', 'verb'], items: [{ text: 'dog', group: 0 }, { text: 'run', group: 1 }] });
    expect(checkAnswer(x, { placement: [0, 1] })).toBe(true);
    expect(checkAnswer(x, { placement: [1, 0] })).toBe(false);
    expect(checkAnswer(x, { placement: [0] })).toBe(false);
  });
  it('wrong-shaped responses are false, never throw', () => {
    const x = q('pick_one', { prompt: 'p', choices: ['a', 'b'], answer: 0 });
    expect(checkAnswer(x, { order: ['a'] } as any)).toBe(false);
    expect(checkAnswer(x, null as any)).toBe(false);
    expect(checkAnswer(x, { choice: '0' } as any)).toBe(false);
    const b = q('build_it', { prompt: 'p', tiles: ['a', 'b'] });
    expect(checkAnswer(b, { choice: 0 } as any)).toBe(false);
    expect(checkAnswer(b, { order: 'ab' } as any)).toBe(false);
  });
});

describe('parseQuestion', () => {
  it('returns {type, ...payload}', () => {
    const x = parseQuestion('pick_one', { prompt: 'p', choices: ['a', 'b'], answer: 1 });
    expect(x).toEqual({ type: 'pick_one', prompt: 'p', choices: ['a', 'b'], answer: 1 });
  });
  it('rejects answer out of range', () => {
    expect(() => parseQuestion('pick_one', { prompt: 'p', choices: ['a', 'b'], answer: 2 })).toThrow();
    expect(() => parseQuestion('pick_one', { prompt: 'p', choices: ['a', 'b'], answer: -1 })).toThrow();
    expect(() => parseQuestion('fill_blank', { before: 'a', after: 'b', choices: ['x'], answer: 1 })).toThrow();
    expect(() => parseQuestion('listen_tap', { prompt: 'p', audioText: 'a', choices: [{ text: 'a' }], answer: 3 })).toThrow();
  });
  it('pick_one needs 2-4 choices', () => {
    expect(() => parseQuestion('pick_one', { prompt: 'p', choices: ['a'], answer: 0 })).toThrow();
    expect(() => parseQuestion('pick_one', { prompt: 'p', choices: ['a', 'b', 'c', 'd', 'e'], answer: 0 })).toThrow();
  });
  it('find_fix indices', () => {
    expect(() => parseQuestion('find_fix', { words: ['a', 'b'], wrongIndex: 2, fixes: ['x', 'y'], answer: 0 })).toThrow();
    expect(() => parseQuestion('find_fix', { words: ['a', 'b'], wrongIndex: 0, fixes: ['x', 'y'], answer: 2 })).toThrow();
  });
  it('sort_it item group in range', () => {
    expect(() => parseQuestion('sort_it', { prompt: 'p', groups: ['a', 'b'], items: [{ text: 'x', group: 2 }] })).toThrow();
  });
  it('build_it needs 2 tiles', () => {
    expect(() => parseQuestion('build_it', { prompt: 'p', tiles: ['a'] })).toThrow();
  });
  it('rejects blank strings', () => {
    expect(() => parseQuestion('pick_one', { prompt: '  ', choices: ['a', 'b'], answer: 0 })).toThrow();
    expect(() => parseQuestion('pick_one', { prompt: 'p', choices: ['a', ' '], answer: 0 })).toThrow();
  });
  it('unknown type throws readable error', () => {
    expect(() => parseQuestion('nope', {})).toThrow(/question type/i);
  });
  it('listen_tap choice may have image', () => {
    const x = q('listen_tap', { prompt: 'p', audioText: 'a', choices: [{ text: 'a', image: 'https://x/y.png' }, { text: 'b' }], answer: 0 });
    expect(x.choices[0].image).toBe('https://x/y.png');
  });
  it('watch_answer', () => {
    const inner = { type: 'pick_one', prompt: 'p', choices: ['a', 'b'], answer: 0 };
    const w = parseQuestion('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [inner] });
    expect(w.type).toBe('watch_answer');
    expect(() => parseQuestion('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [] })).toThrow();
    expect(() => parseQuestion('watch_answer', { youtubeId: ' ', questions: [inner] })).toThrow();
    expect(() => parseQuestion('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'watch_answer', youtubeId: 'x', questions: [inner] }] })).toThrow();
    expect(() => parseQuestion('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ ...inner, answer: 5 }] })).toThrow();
  });
});

describe('watch_answer youtubeId', () => {
  const inner = { type: 'pick_one', prompt: 'p', choices: ['a', 'b'], answer: 0 };
  it('must be an 11-character YouTube id', () => {
    expect(() => parseQuestion('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [inner] })).not.toThrow();
    for (const bad of ['abc', 'dQw4w9WgXcQ1', 'dQw4w9WgXc!', 'https://youtu.be/dQw4w9WgXcQ', '']) {
      expect(() => parseQuestion('watch_answer', { youtubeId: bad, questions: [inner] })).toThrow();
    }
  });
});
