import { describe, expect, it } from 'vitest';
import { parseQuestion } from '@/lib/questions/schema';
import { draftFromQuestion, draftToPayload, type NonWatchDraft } from '@/lib/questions/draft';

const pick = { prompt: 'Pick one.', choices: ['an egg', 'a egg'], answer: 0 };

describe('question pictures in the schema', () => {
  it('keeps a valid picture name', () => {
    expect(parseQuestion('pick_one', { ...pick, picture: 'egg' })).toMatchObject({ picture: 'egg' });
  });
  it('rejects names that are not picture names', () => {
    expect(() => parseQuestion('pick_one', { ...pick, picture: '../secret' })).toThrow();
    expect(() => parseQuestion('pick_one', { ...pick, picture: 'a'.repeat(65) })).toThrow();
    expect(() => parseQuestion('pick_one', { ...pick, picture: 'Egg' })).toThrow();
  });
  it('a question saved before pictures still parses the same', () => {
    expect(parseQuestion('pick_one', pick)).toEqual({ type: 'pick_one', ...pick });
  });
  it('works on every non-video type and on questions inside a video', () => {
    expect(parseQuestion('fill_blank', { before: 'I see', after: 'owl.', choices: ['a', 'an'], answer: 1, picture: 'owl' })).toMatchObject({ picture: 'owl' });
    expect(parseQuestion('find_fix', { words: ['Tom', 'ate', 'a', 'apple.'], wrongIndex: 2, fixes: ['an', 'two'], answer: 0, picture: 'red-apple' })).toMatchObject({ picture: 'red-apple' });
    expect(parseQuestion('build_it', { prompt: 'Build it.', tiles: ['I', 'see', 'a', 'cat.'], picture: 'cat' })).toMatchObject({ picture: 'cat' });
    expect(parseQuestion('sort_it', { prompt: 'Sort.', groups: ['a', 'an'], items: [{ text: 'egg', group: 1 }], picture: 'egg' })).toMatchObject({ picture: 'egg' });
    const w = parseQuestion('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'pick_one', ...pick, picture: 'egg' }] });
    expect(w.type === 'watch_answer' && w.questions[0]).toMatchObject({ picture: 'egg' });
  });
});

describe('question pictures in editor drafts', () => {
  it('a question without a picture gives an empty picture field', () => {
    const d = draftFromQuestion(parseQuestion('pick_one', pick)) as NonWatchDraft;
    expect(d.picture).toBe('');
    expect(draftToPayload(d)).not.toHaveProperty('picture');
  });
  it('a picture survives the round trip', () => {
    const d = draftFromQuestion(parseQuestion('pick_one', { ...pick, picture: 'egg' })) as NonWatchDraft;
    expect(d.picture).toBe('egg');
    expect(draftToPayload(d)).toMatchObject({ picture: 'egg' });
    expect(draftToPayload({ ...d, picture: '  ' })).not.toHaveProperty('picture');
  });
});
