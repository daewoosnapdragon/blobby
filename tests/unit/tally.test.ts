import { describe, it, expect } from 'vitest';
import { addToTally, tallyLines, type Tally } from '@/lib/tally';
import type { NonWatchQuestion } from '@/lib/questions/schema';

const build: NonWatchQuestion = { type: 'build_it', prompt: 'p', tiles: ['I', 'run'] };
const sortWith3Items: NonWatchQuestion = {
  type: 'sort_it',
  prompt: 'p',
  groups: ['g1', 'g2'],
  items: [
    { text: 'a', group: 0 },
    { text: 'b', group: 1 },
    { text: 'c', group: 0 },
  ],
};

describe('tally', () => {
  it('counts questions, and words for sort_it', () => {
    let t: Tally = {};
    t = addToTally(t, build);
    t = addToTally(t, sortWith3Items);
    t = addToTally(t, sortWith3Items);
    expect(t).toEqual({ build_it: 1, sort_it: 6 });
  });
  it('tallyLines: top three by count, singulars, spec copy', () => {
    expect(tallyLines({ build_it: 1, find_fix: 4, sort_it: 12, fill_blank: 5, pick_one: 2 })).toEqual([
      'You sorted 12 words',
      'You filled 5 blanks',
      'You fixed 4 mistakes',
    ]);
    expect(tallyLines({ build_it: 1 })).toEqual(['You built 1 sentence']);
    expect(tallyLines({ listen_tap: 3, pick_one: 1 })).toEqual(['You matched 3 words', 'You picked 1 right sentence']);
    expect(tallyLines({})).toEqual([]);
  });
  it('ties follow the table order', () => {
    expect(tallyLines({ listen_tap: 1, build_it: 1, sort_it: 1, pick_one: 1 })).toEqual([
      'You built 1 sentence',
      'You sorted 1 word',
      'You picked 1 right sentence',
    ]);
  });
});
