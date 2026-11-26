import { describe, it, expect } from 'vitest';
import { missingPictures, contentRuleProblems } from '@/lib/content';
import { questionSchema } from '@/lib/questions/schema';

describe('missingPictures', () => {
  it('names picture_first questions whose picture file is missing', () => {
    const qs = [
      { type: 'picture_first', picture: 'frog', prompt: 'p', choices: ['a frog', 'frogs'], answer: 0 },
      { type: 'picture_first', picture: 'nope', prompt: 'p', choices: ['a', 'b'], answer: 0 },
      { type: 'pick_one', picture: 'nope-too', prompt: 'p', choices: ['a', 'b'], answer: 0 },
    ];
    // pick_one's decorative picture is not reported
    expect(missingPictures(qs, (n) => n === 'frog')).toEqual(['nope']);
  });

  it('looks inside a watch and answer question and names each missing picture once', () => {
    const pf = (picture: string) => ({ type: 'picture_first', picture, prompt: 'p', choices: ['a', 'b'], answer: 0 });
    const qs = [
      pf('gone'),
      { type: 'watch_answer', youtubeId: 'x', questions: [pf('frog'), pf('lost'), pf('gone')] },
    ];
    expect(missingPictures(qs, (n) => n === 'frog')).toEqual(['gone', 'lost']);
  });

  it('returns nothing when every picture exists', () => {
    expect(missingPictures([], () => false)).toEqual([]);
    expect(missingPictures([{ type: 'picture_first', picture: 'frog' }], () => true)).toEqual([]);
  });
});

describe('contentRuleProblems', () => {
  const rw = (prompt = 'Is it right?') => questionSchema.parse({ type: 'right_wrong', prompt, sentence: 'He go home.', right: false });
  const pick = (choices = ['a', 'b'], prompt = 'Pick one.') => questionSchema.parse({ type: 'pick_one', prompt, choices, answer: 0 });
  const sort = (g: string, prompt = 'Sort these.') => questionSchema.parse({ type: 'sort_it', prompt, groups: [g, 'Other'], items: [{ text: 'x', group: 0 }] });
  const W = 'week 1, lesson "L"';

  it('flags a lesson where every question is right_wrong', () => {
    expect(contentRuleProblems([rw(), rw(), rw()], W)).toEqual([`${W}: every question is right_wrong`]);
  });
  it('flags the whole word wrong in a prompt', () => {
    expect(contentRuleProblems([pick(['a', 'b'], 'Right or wrong?')], W)).toEqual([`${W}, question 1: "wrong" in prompt: Right or wrong?`]);
  });
  it('flags a sort group labelled Wrong', () => {
    expect(contentRuleProblems([pick(), sort('Wrong')], W)).toEqual([`${W}, question 2: "wrong" in a sort group: Wrong`]);
  });
  it('ignores choice texts', () => {
    expect(contentRuleProblems([pick(['wrong way', 'right way'])], W)).toEqual([]);
  });
  it('returns [] for a clean lesson and an empty one', () => {
    expect(contentRuleProblems([pick(), rw()], W)).toEqual([]);
    expect(contentRuleProblems([], W)).toEqual([]);
  });
  it('looks inside watch_answer with outer.inner positions', () => {
    const watch = questionSchema.parse({ type: 'watch_answer', youtubeId: 'abcdefghijk', questions: [pick(), sort('Wrong')] });
    expect(contentRuleProblems([pick(), pick(), watch], W)).toEqual([`${W}, question 3.2: "wrong" in a sort group: Wrong`]);
  });
});
