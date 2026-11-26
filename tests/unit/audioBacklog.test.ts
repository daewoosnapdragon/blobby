import { describe, it, expect } from 'vitest';
import { missingStrings, type AudioRow } from '@/lib/audioBacklog';
import type { Question } from '@/lib/questions/schema';

const pick = (prompt: string, choices: string[]): Question => ({ type: 'pick_one', prompt, choices, answer: 0 } as Question);

describe('missingStrings', () => {
  it('lists, per row, the spoken strings with no audio key', () => {
    const rows: AudioRow[] = [
      { id: 'a', question: pick('Which one is right?', ['I ran.', 'I runned.']), audio: { 'Which one is right?': 'u1' } },
      { id: 'b', question: pick('Pick one.', ['Yes.', 'No.']), audio: {} },
    ];
    expect(missingStrings(rows)).toEqual([
      { id: 'a', texts: ['I ran.', 'I runned.'] },
      { id: 'b', texts: ['Pick one.', 'Yes.', 'No.'] },
    ]);
  });

  it('omits rows that have every string, and ignores extra audio keys', () => {
    const q = pick('Hi?', ['A.', 'B.']);
    expect(missingStrings([{ id: 'a', question: q, audio: { 'Hi?': 'u', 'A.': 'u', 'B.': 'u', 'Old text.': 'u' } }])).toEqual([]);
    expect(missingStrings([])).toEqual([]);
  });

  it('uses the trimmed, deduped strings the read-aloud speaks', () => {
    const q = pick(' Same. ', ['Same.', 'Other.']);
    expect(missingStrings([{ id: 'a', question: q, audio: {} }])).toEqual([{ id: 'a', texts: ['Same.', 'Other.'] }]);
  });
});
