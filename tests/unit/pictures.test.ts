import { describe, expect, it } from 'vitest';
import { pictureSrc, searchPictures, singular, suggestPictures, type PictureEntry } from '@/lib/pictures';

const CATALOG: PictureEntry[] = [
  { n: 'elephant', l: 'elephant', k: ['elephant', 'animal'] },
  { n: 'mouse', l: 'mouse', k: ['mouse', 'animal'] },
  { n: 'mouse-face', l: 'mouse face', k: ['mouse', 'face'] },
  { n: 'computer-mouse', l: 'computer mouse', k: ['computer'] },
  { n: 'child', l: 'child', k: ['child', 'young'] },
  { n: 'package', l: 'package', k: ['box', 'parcel'] },
  { n: 'strawberry', l: 'strawberry', k: ['berry', 'fruit'] },
  { n: 'taxi', l: 'taxi', k: ['car', 'vehicle'] },
  { n: 'automobile', l: 'automobile', k: ['car'] },
  { n: 'red-apple', l: 'red apple', k: ['apple', 'fruit', 'red'] },
  { n: 'school', l: 'school', k: ['building'] },
  { n: 'cheese-wedge', l: 'cheese wedge', k: ['cheese'] },
  { n: 'mouse-trap', l: 'mouse trap', k: ['bait', 'trap'] },
  { n: 'tram-car', l: 'tram car', k: ['car', 'tram'] },
  { n: 'family-adult-child', l: 'family adult child', k: ['family'] },
];

describe('singular', () => {
  it.each([
    ['mice', 'mouse'], ['children', 'child'], ['feet', 'foot'], ['teeth', 'tooth'], ['people', 'person'],
    ['boxes', 'box'], ['berries', 'berry'], ['cats', 'cat'], ['bus', 'bus'], ['glass', 'glass'], ['Dogs', 'dog'],
  ])('%s -> %s', (word, want) => expect(singular(word)).toBe(want));
});

describe('suggestPictures', () => {
  it('suggests the key noun of a sentence', () => {
    expect(suggestPictures('Ben drew an elephant today.', CATALOG)[0].n).toBe('elephant');
  });
  it('matches plurals and irregular plurals', () => {
    expect(suggestPictures('Three mice ran under the table.', CATALOG).map((p) => p.n)).toContain('mouse');
    expect(suggestPictures('The children are reading.', CATALOG)[0].n).toBe('child');
    expect(suggestPictures('There are two boxes.', CATALOG).map((p) => p.n)).toContain('package');
  });
  it('puts an exact picture name before a keyword match', () => {
    expect(suggestPictures('a mouse', CATALOG)[0].n).toBe('mouse');
  });
  it('matches a word inside a longer picture name', () => {
    expect(suggestPictures('I ate an apple.', CATALOG)[0].n).toBe('red-apple');
  });
  it('never suggests for very common words', () => {
    expect(suggestPictures('The is a an it red', CATALOG).map((p) => p.n)).not.toContain('red-apple');
  });
  it('gives each noun its best picture before any extras', () => {
    const r = suggestPictures('Three mice ate the cheese.', CATALOG).map((p) => p.n);
    expect(r.slice(0, 2)).toEqual(['mouse', 'cheese-wedge']);
  });
  it('uses the everyday picture for common words', () => {
    expect(suggestPictures('My dad drives a red car.', CATALOG)[0].n).toBe('automobile');
  });
  it('prefers the plain picture over a busy variant', () => {
    expect(suggestPictures('The children are in the garden.', CATALOG)[0].n).toBe('child');
  });
  it('returns at most n, without repeats', () => {
    const r = suggestPictures('mouse mice mouse', CATALOG, 2);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(new Set(r.map((p) => p.n)).size).toBe(r.length);
  });
});

describe('searchPictures', () => {
  it('finds by name, ignoring case and spaces', () => {
    expect(searchPictures('  Taxi ', CATALOG)[0].n).toBe('taxi');
  });
  it('finds by keyword', () => {
    expect(searchPictures('car', CATALOG).map((p) => p.n).sort()).toEqual(['automobile', 'taxi', 'tram-car']);
  });
  it('finds by the start of a word', () => {
    expect(searchPictures('eleph', CATALOG)[0].n).toBe('elephant');
  });
  it('returns nothing for an empty query', () => {
    expect(searchPictures('   ', CATALOG)).toEqual([]);
  });
});

describe('pictureSrc', () => {
  it('points at the shipped file', () => expect(pictureSrc('elephant')).toBe('/pictures/elephant.svg'));
});
