import { describe, it, expect } from 'vitest';
import { parseQuestion, QUESTION_TYPES, type Question } from '@/lib/questions/schema';
import { addableTypes, draftFromQuestion, draftToPayload, emptyDraft } from '@/lib/questions/draft';
import { questionProblems } from '@/lib/questions/problems';
import { weekdayName } from '@/lib/dates';

function roundTrip(q: Question) {
  const { type, ...rest } = q;
  void rest;
  const draft = draftFromQuestion(q);
  return parseQuestion(type, draftToPayload(draft));
}

const samples: Question[] = [
  { type: 'pick_one', prompt: 'Which is right?', choices: ['a', 'b', 'c'], answer: 2 },
  { type: 'fill_blank', before: 'Yesterday, we', after: 'pizza.', choices: ['eat', 'ate'], answer: 1 },
  { type: 'find_fix', words: ['She', 'goed', 'home.'], wrongIndex: 1, fixes: ['go', 'went'], answer: 1 },
  { type: 'build_it', prompt: 'Make a sentence.', tiles: ['I', 'like', 'cats.'], distractors: ['likes'] },
  { type: 'build_it', prompt: 'Make a sentence.', tiles: ['I', 'like', 'cats.'] },
  { type: 'sort_it', prompt: 'Sort.', groups: ['noun', 'verb'], items: [{ text: 'dog', group: 0 }, { text: 'run', group: 1 }] },
  { type: 'listen_tap', prompt: 'Tap the word.', audioText: 'bee', choices: [{ text: 'bee' }, { text: 'tree' }], answer: 0 },
  { type: 'watch_answer', youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'pick_one', prompt: 'Why?', choices: ['x', 'y'], answer: 0 }] },
];

describe('editor drafts', () => {
  it.each(samples.map((q) => [q.type, q] as const))('a %s question survives edit and save unchanged', (_t, q) => {
    expect(roundTrip(q)).toEqual(q);
  });

  it('a pick_one form with a blank row drops it and keeps the right answer on the right choice', () => {
    const d = { type: 'pick_one' as const, prompt: ' Which? ', choices: ['a', '', 'c'], answer: 2 };
    const q = parseQuestion('pick_one', draftToPayload(d));
    expect(q).toMatchObject({ prompt: 'Which?', choices: ['a', 'c'], answer: 1 });
  });

  it('a find_fix form splits the sentence into words', () => {
    const d = { type: 'find_fix' as const, sentence: '  She  goed home. ', wrongIndex: 1, fixes: ['go', 'went'], answer: 1 };
    expect(draftToPayload(d)).toMatchObject({ words: ['She', 'goed', 'home.'], wrongIndex: 1 });
  });

  it('every type has an empty draft that is not valid until filled in', () => {
    for (const t of ['pick_one', 'listen_tap', 'find_fix', 'build_it', 'sort_it', 'fill_blank', 'watch_answer'] as const) {
      const d = emptyDraft(t);
      expect(d.type).toBe(t);
      expect(questionProblems(t, draftToPayload(d)).length).toBeGreaterThan(0);
    }
  });

  it('a removed right answer is a readable problem, not a crash', () => {
    const d = { type: 'pick_one' as const, prompt: 'Q', choices: ['a', '', 'c'], answer: 1 };
    const msgs = questionProblems('pick_one', draftToPayload(d));
    expect(msgs.join(' ')).toMatch(/right answer/i);
  });
});

describe('weekdayName', () => {
  it('names the weekday of a calendar date', () => {
    expect(weekdayName('2026-11-25')).toBe('Wednesday');
    expect(weekdayName('2026-12-21')).toBe('Monday');
    expect(weekdayName('')).toBe('');
    expect(weekdayName('2026-02-30')).toBe('');
  });
});

describe('addableTypes', () => {
  it('hides Listen and tap while read-aloud is off (the default for now)', () => {
    expect(addableTypes()).toEqual(QUESTION_TYPES.filter((t) => t !== 'listen_tap'));
  });
  it('offers every type with read-aloud on', () => {
    expect(addableTypes(true)).toEqual(QUESTION_TYPES);
  });
});
