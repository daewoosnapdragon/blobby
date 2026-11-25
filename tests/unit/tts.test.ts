import { describe, it, expect, vi } from 'vitest';
import { audioKey, ensureAudio, spokenStrings, type AudioStorage } from '@/lib/tts';
import { parseQuestion } from '@/lib/questions/schema';

function memStorage(existing: string[] = []): AudioStorage & { uploaded: string[] } {
  const have = new Set(existing);
  const uploaded: string[] = [];
  return {
    uploaded,
    exists: async (key) => have.has(key),
    upload: async (key) => { have.add(key); uploaded.push(key); },
    publicUrl: (key) => `https://cdn.test/wp-audio/audio/${key}.mp3`,
  };
}

describe('audioKey', () => {
  it('is a stable sha256 hex that changes with text or voice', () => {
    const a = audioKey('Hello', 'nova');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(audioKey('Hello', 'nova')).toBe(a);
    expect(audioKey('Hello!', 'nova')).not.toBe(a);
    expect(audioKey('Hello', 'alloy')).not.toBe(a);
  });
});

describe('spokenStrings', () => {
  it('listen_tap: prompt, audioText, choices', () => {
    const q = parseQuestion('listen_tap', {
      prompt: 'Tap the word you hear.', audioText: 'tree', choices: [{ text: 'bee' }, { text: 'tree' }], answer: 1,
    });
    expect(spokenStrings(q)).toEqual(['Tap the word you hear.', 'tree', 'bee']);
  });
  it('pick_one: prompt and choices, deduped and trimmed', () => {
    const q = parseQuestion('pick_one', { prompt: ' Pick one. ', choices: ['A cat.', 'A cat.', 'Two cats.'], answer: 2 });
    expect(spokenStrings(q)).toEqual(['Pick one.', 'A cat.', 'Two cats.']);
  });
  it('fill_blank: prompt, sentence with ellipsis, choices', () => {
    const q = parseQuestion('fill_blank', { before: 'She', after: 'to school.', choices: ['walks', 'walk'], answer: 0 });
    expect(spokenStrings(q)).toEqual(['She … to school.', 'walks', 'walk']);
  });
  it('find_fix: sentence and fixes', () => {
    const q = parseQuestion('find_fix', { words: ['He', 'go', 'home.'], wrongIndex: 1, fixes: ['goes', 'going'], answer: 0 });
    expect(spokenStrings(q)).toEqual(['He go home.', 'goes', 'going']);
  });
  it('sort_it: prompt and items; build_it: prompt only', () => {
    const s = parseQuestion('sort_it', {
      prompt: 'Sort the words.', groups: ['Noun', 'Verb'], items: [{ text: 'dog', group: 0 }, { text: 'run', group: 1 }],
    });
    expect(spokenStrings(s)).toEqual(['Sort the words.', 'dog', 'run']);
    const b = parseQuestion('build_it', { prompt: 'Build the sentence.', tiles: ['I', 'run.'] });
    expect(spokenStrings(b)).toEqual(['Build the sentence.']);
  });
  it('watch_answer: union of inner questions', () => {
    const q = parseQuestion('watch_answer', {
      youtubeId: 'dQw4w9WgXcQ',
      questions: [
        { type: 'pick_one', prompt: 'Q1?', choices: ['x', 'y'], answer: 0 },
        { type: 'pick_one', prompt: 'Q2?', choices: ['x', 'z'], answer: 1 },
      ],
    });
    expect(spokenStrings(q)).toEqual(['Q1?', 'x', 'y', 'Q2?', 'z']);
  });
});

describe('ensureAudio', () => {
  const q = parseQuestion('pick_one', { prompt: 'Pick one.', choices: ['A', 'B'], answer: 0 });

  it('synthesizes only missing keys and returns a url for every string', async () => {
    const storage = memStorage([audioKey('Pick one.', 'nova')]);
    const synthesize = vi.fn(async (t: string) => Buffer.from(t));
    const map = await ensureAudio(q, { storage, synthesize, voice: 'nova' });
    expect(synthesize.mock.calls.map((c) => c[0])).toEqual(['A', 'B']);
    expect(Object.keys(map)).toEqual(['Pick one.', 'A', 'B']);
    expect(map['A']).toBe(`https://cdn.test/wp-audio/audio/${audioKey('A', 'nova')}.mp3`);
  });

  it('does nothing when everything exists', async () => {
    const storage = memStorage(['Pick one.', 'A', 'B'].map((t) => audioKey(t, 'nova')));
    const synthesize = vi.fn(async () => Buffer.from(''));
    await ensureAudio(q, { storage, synthesize, voice: 'nova' });
    expect(synthesize).not.toHaveBeenCalled();
    expect(storage.uploaded).toEqual([]);
  });
});
