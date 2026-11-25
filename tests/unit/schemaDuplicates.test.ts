import { describe, it, expect } from 'vitest';
import { parseQuestion } from '@/lib/questions/schema';
import { questionProblems } from '@/lib/questions/problems';

const ok = (type: string, p: object) => expect(() => parseQuestion(type, p)).not.toThrow();
const bad = (type: string, p: object, re: RegExp) => expect(() => parseQuestion(type, p)).toThrow(re);

describe('no duplicate choices', () => {
  it('pick_one: same text, ignoring case and spaces, is rejected', () => {
    bad('pick_one', { prompt: 'P', choices: ['dogs', ' Dogs '], answer: 0 }, /choices\.1: is the same as choice 1/);
    bad('pick_one', { prompt: 'P', choices: ['a big dog', 'a  big dog', 'cat'], answer: 2 }, /choices\.1/);
    ok('pick_one', { prompt: 'P', choices: ['dogs', 'dog'], answer: 0 });
  });
  it('fill_blank', () => {
    bad('fill_blank', { before: 'I', after: '.', choices: ['ran', 'RAN'], answer: 0 }, /is the same as choice 1/);
    ok('fill_blank', { before: 'I', after: '.', choices: ['ran', 'run'], answer: 0 });
  });
  it('listen_tap compares choice texts', () => {
    bad('listen_tap', { prompt: 'P', audioText: 'cat', choices: [{ text: 'cat' }, { text: 'Cat' }], answer: 0 }, /choices\.1: is the same as choice 1/);
    ok('listen_tap', { prompt: 'P', audioText: 'cat', choices: [{ text: 'cat' }, { text: 'cap' }], answer: 0 });
  });
});

describe('find_fix fixes', () => {
  const base = { words: ['She', 'goed', 'home.'], wrongIndex: 1 };
  it('must not include the wrong word itself', () => {
    bad('find_fix', { ...base, fixes: ['went', 'Goed'], answer: 0 }, /fixes\.1: is the same as the wrong word/);
  });
  it('must be unique', () => {
    bad('find_fix', { ...base, fixes: ['went', 'gone', 'went'], answer: 0 }, /fixes\.2: is the same as fix 1/);
  });
  it('accepts distinct fixes that differ from the wrong word', () => {
    ok('find_fix', { ...base, fixes: ['went', 'gone'], answer: 0 });
  });
});

describe('build_it distractors', () => {
  it('must not equal any tile', () => {
    bad('build_it', { prompt: 'P', tiles: ['I', 'ran.'], distractors: ['run', 'I'] }, /distractors\.1: is the same as a tile/);
    ok('build_it', { prompt: 'P', tiles: ['I', 'ran.'], distractors: ['run'] });
    ok('build_it', { prompt: 'P', tiles: ['I', 'ran.'] });
  });
});

describe('sort_it items', () => {
  it('must have unique texts', () => {
    bad('sort_it', { prompt: 'P', groups: ['a', 'b'], items: [{ text: 'cat', group: 0 }, { text: 'CAT', group: 1 }] }, /items\.1: is the same as word 1/);
    ok('sort_it', { prompt: 'P', groups: ['a', 'b'], items: [{ text: 'cat', group: 0 }, { text: 'eat', group: 1 }] });
  });
});

describe('inside watch_answer, and in the editor', () => {
  it('nested questions are checked too', () => {
    bad('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'pick_one', prompt: 'P', choices: ['x', 'x'], answer: 0 }] },
      /questions\.0\.choices\.1: is the same as choice 1/);
  });
  it('empty texts are only "fill this in", never also "the same as"', () => {
    expect(questionProblems('pick_one', { prompt: 'P', choices: ['', ''], answer: 0 })).toEqual(['Choice 1: fill this in.', 'Choice 2: fill this in.']);
  });
  it('the editor gets readable sentences', () => {
    expect(questionProblems('pick_one', { prompt: 'P', choices: ['dogs', 'Dogs'], answer: 0 })).toEqual(['Choice 2: is the same as choice 1.']);
    expect(questionProblems('find_fix', { words: ['She', 'goed'], wrongIndex: 1, fixes: ['goed', 'went'], answer: 1 }))
      .toEqual(['Fix 1: is the same as the wrong word.']);
    expect(questionProblems('build_it', { prompt: 'P', tiles: ['I', 'ran.'], distractors: ['ran.'] })).toEqual(['Extra tile 1: is the same as a tile.']);
    expect(questionProblems('sort_it', { prompt: 'P', groups: ['a', 'b'], items: [{ text: 'cat', group: 0 }, { text: 'cat', group: 1 }] }))
      .toEqual(['Word 2: is the same as word 1.']);
    expect(questionProblems('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'fill_blank', before: 'I', after: '', choices: ['a', 'A'], answer: 0 }] }))
      .toEqual(['Question 1, Choice 2: is the same as choice 1.']);
  });
});
