// What the editor forms hold while Kyla types: plain strings and indexes, no validation.
// draftToPayload cleans a draft into the payload parseQuestion checks. Pure and client-safe.
import { QUESTION_TYPES, type Question, type QuestionType } from './schema';
import { READ_ALOUD } from '../features';

export type NonWatchDraft =
  | { type: 'pick_one'; prompt: string; choices: string[]; answer: number }
  | { type: 'listen_tap'; prompt: string; audioText: string; choices: string[]; answer: number }
  | { type: 'find_fix'; sentence: string; wrongIndex: number; fixes: string[]; answer: number }
  | { type: 'build_it'; prompt: string; tiles: string[]; distractors: string[] }
  | { type: 'sort_it'; prompt: string; groups: string[]; items: { text: string; group: number }[] }
  | { type: 'fill_blank'; before: string; after: string; choices: string[]; answer: number };
export type WatchDraft = { type: 'watch_answer'; video: string; questions: NonWatchDraft[] };
export type Draft = NonWatchDraft | WatchDraft;

export const TYPE_NAMES: Record<QuestionType, string> = {
  pick_one: 'Pick the right one',
  fill_blank: 'Fill the blank',
  find_fix: 'Find and fix',
  build_it: 'Build it',
  sort_it: 'Sort it',
  listen_tap: 'Listen and tap',
  watch_answer: 'Watch and answer',
};

/** Types a teacher can add. Listen and tap needs read-aloud audio, so it is hidden while that is off. */
export const addableTypes = (readAloud: boolean = READ_ALOUD): QuestionType[] =>
  QUESTION_TYPES.filter((t) => readAloud || t !== 'listen_tap');

export function emptyDraft(type: Exclude<QuestionType, 'watch_answer'>): NonWatchDraft;
export function emptyDraft(type: QuestionType): Draft;
export function emptyDraft(type: QuestionType): Draft {
  switch (type) {
    case 'pick_one': return { type, prompt: '', choices: ['', ''], answer: -1 };
    case 'listen_tap': return { type, prompt: 'Tap the word you hear.', audioText: '', choices: ['', ''], answer: -1 };
    case 'find_fix': return { type, sentence: '', wrongIndex: -1, fixes: ['', ''], answer: -1 };
    case 'build_it': return { type, prompt: '', tiles: ['', ''], distractors: [] };
    case 'sort_it': return { type, prompt: '', groups: ['', ''], items: [{ text: '', group: 0 }] };
    case 'fill_blank': return { type, before: '', after: '', choices: ['', ''], answer: -1 };
    case 'watch_answer': return { type, video: '', questions: [emptyDraft('pick_one')] };
  }
}

export function draftFromQuestion(q: Question): Draft {
  switch (q.type) {
    case 'pick_one': return { type: q.type, prompt: q.prompt, choices: [...q.choices], answer: q.answer };
    case 'listen_tap': return { type: q.type, prompt: q.prompt, audioText: q.audioText, choices: q.choices.map((c) => c.text), answer: q.answer };
    case 'find_fix': return { type: q.type, sentence: q.words.join(' '), wrongIndex: q.wrongIndex, fixes: [...q.fixes], answer: q.answer };
    case 'build_it': return { type: q.type, prompt: q.prompt, tiles: [...q.tiles], distractors: [...(q.distractors ?? [])] };
    case 'sort_it': return { type: q.type, prompt: q.prompt, groups: [...q.groups], items: q.items.map((i) => ({ ...i })) };
    case 'fill_blank': return { type: q.type, before: q.before, after: q.after, choices: [...q.choices], answer: q.answer };
    case 'watch_answer': return { type: q.type, video: q.youtubeId, questions: q.questions.map((x) => draftFromQuestion(x) as NonWatchDraft) };
  }
}

/** Drops blank rows and moves the right-answer index with its row. A blank right answer becomes -1 (not picked). */
function compact(list: string[], answer: number): { list: string[]; answer: number } {
  const out: string[] = [];
  let a = -1;
  list.forEach((raw, i) => {
    const t = raw.trim();
    if (!t) return;
    if (i === answer) a = out.length;
    out.push(t);
  });
  return { list: out, answer: a };
}
const nonBlank = (l: string[]) => l.map((t) => t.trim()).filter(Boolean);

type Payload = Record<string, unknown>;

/** The payload for parseQuestion(type, payload). For watch_answer the inner questions carry their `type`; `youtubeId` is whatever was typed (link or id). */
export function draftToPayload(d: Draft): Payload {
  switch (d.type) {
    case 'pick_one': {
      const c = compact(d.choices, d.answer);
      return { prompt: d.prompt.trim(), choices: c.list, answer: c.answer };
    }
    case 'listen_tap': {
      const c = compact(d.choices, d.answer);
      return { prompt: d.prompt.trim(), audioText: d.audioText.trim(), choices: c.list.map((text) => ({ text })), answer: c.answer };
    }
    case 'find_fix': {
      const f = compact(d.fixes, d.answer);
      return { words: d.sentence.trim().split(/\s+/).filter(Boolean), wrongIndex: d.wrongIndex, fixes: f.list, answer: f.answer };
    }
    case 'build_it': {
      const distractors = nonBlank(d.distractors);
      return { prompt: d.prompt.trim(), tiles: nonBlank(d.tiles), ...(distractors.length ? { distractors } : {}) };
    }
    case 'sort_it':
      return {
        prompt: d.prompt.trim(),
        groups: d.groups.map((g) => g.trim()),
        items: d.items.filter((i) => i.text.trim()).map((i) => ({ text: i.text.trim(), group: i.group })),
      };
    case 'fill_blank': {
      const c = compact(d.choices, d.answer);
      return { before: d.before.trim(), after: d.after.trim(), choices: c.list, answer: c.answer };
    }
    case 'watch_answer':
      return { youtubeId: d.video.trim(), questions: d.questions.map((q) => ({ type: q.type, ...draftToPayload(q) })) };
  }
}
