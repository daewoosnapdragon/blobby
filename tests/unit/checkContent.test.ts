import { describe, it, expect } from 'vitest';
import { missingPictures } from '@/lib/content';

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
