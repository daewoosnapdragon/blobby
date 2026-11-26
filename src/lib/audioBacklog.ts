// Pure: which read-aloud strings still have no audio ("Make missing audio" on the teacher Plans page).
import type { Question } from './questions/schema';
import { spokenStrings } from './spoken';

export interface AudioRow { id: string; question: Question; audio: Record<string, string> }

/** Per row, the spoken strings not present as keys in its `audio`; rows with none are left out. */
export function missingStrings(rows: AudioRow[]): { id: string; texts: string[] }[] {
  return rows
    .map((r) => ({ id: r.id, texts: spokenStrings(r.question).filter((t) => !Object.hasOwn(r.audio, t)) }))
    .filter((r) => r.texts.length > 0);
}
