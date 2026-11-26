// What the editor forms hold while Kyla types: plain strings and indexes, no validation.
// draftToPayload cleans a draft into the payload parseQuestion checks. Pure and client-safe.
import type { Question, QuestionType } from './schema';

/** Every non-video draft has a picture name ('' for none). */
type WithPicture = { picture?: string };
export type NonWatchDraft = WithPicture & (
  | { type: 'pick_one'; prompt: string; choices: string[]; answer: number }
  | { type: 'listen_tap'; prompt: string; audioText: string; choices: string[]; answer: number }
  | { type: 'find_fix'; sentence: string; wrongIndex: number; fixes: string[]; answer: number }
  | { type: 'build_it'; prompt: string; tiles: string[]; distractors: string[] }
  | { type: 'sort_it'; prompt: string; groups: string[]; items: { text: string; group: number }[] }
  | { type: 'fill_blank'; before: string; after: string; choices: string[]; answer: number }
  | { type: 'right_wrong'; prompt: string; sentence: string; right: boolean | null });
export type WatchDraft = { type: 'watch_answer'; video: string; questions: NonWatchDraft[] };
export type Draft = NonWatchDraft | WatchDraft;

export const TYPE_NAMES: Record<QuestionType, string> = {
  pick_one: 'Pick the right one',
  fill_blank: 'Fill the blank',
  find_fix: 'Find and fix',
  build_it: 'Build it',
  sort_it: 'Sort it',
  listen_tap: 'Listen and tap',
  right_wrong: 'Right or wrong',
  watch_answer: 'Watch and answer',
};

export function emptyDraft(type: Exclude<QuestionType, 'watch_answer'>): NonWatchDraft;
export function emptyDraft(type: QuestionType): Draft;
export function emptyDraft(type: QuestionType): Draft {
  switch (type) {
    case 'pick_one': return { type, picture: '', prompt: '', choices: ['', ''], answer: -1 };
    case 'listen_tap': return { type, picture: '', prompt: 'Tap the word you hear.', audioText: '', choices: ['', ''], answer: -1 };
    case 'find_fix': return { type, picture: '', sentence: '', wrongIndex: -1, fixes: ['', ''], answer: -1 };
    case 'build_it': return { type, picture: '', prompt: '', tiles: ['', ''], distractors: [] };
    case 'sort_it': return { type, picture: '', prompt: '', groups: ['', ''], items: [{ text: '', group: 0 }] };
    case 'fill_blank': return { type, picture: '', before: '', after: '', choices: ['', ''], answer: -1 };
    case 'right_wrong': return { type, picture: '', prompt: 'Is this sentence right?', sentence: '', right: null };
    case 'watch_answer': return { type, video: '', questions: [emptyDraft('pick_one')] };
  }
}

export function draftFromQuestion(q: Question): Draft {
  switch (q.type) {
    case 'pick_one': return { type: q.type, picture: q.picture ?? '', prompt: q.prompt, choices: [...q.choices], answer: q.answer };
    case 'listen_tap': return { type: q.type, picture: q.picture ?? '', prompt: q.prompt, audioText: q.audioText, choices: q.choices.map((c) => c.text), answer: q.answer };
    case 'find_fix': return { type: q.type, picture: q.picture ?? '', sentence: q.words.join(' '), wrongIndex: q.wrongIndex, fixes: [...q.fixes], answer: q.answer };
    case 'build_it': return { type: q.type, picture: q.picture ?? '', prompt: q.prompt, tiles: [...q.tiles], distractors: [...(q.distractors ?? [])] };
    case 'sort_it': return { type: q.type, picture: q.picture ?? '', prompt: q.prompt, groups: [...q.groups], items: q.items.map((i) => ({ ...i })) };
    case 'fill_blank': return { type: q.type, picture: q.picture ?? '', before: q.before, after: q.after, choices: [...q.choices], answer: q.answer };
    case 'right_wrong': return { type: q.type, picture: q.picture ?? '', prompt: q.prompt, sentence: q.sentence, right: q.right };
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
  if (d.type === 'watch_answer') return { youtubeId: d.video.trim(), questions: d.questions.map((q) => ({ type: q.type, ...draftToPayload(q) })) };
  const pic = (d.picture ?? '').trim();
  return { ...nonWatchPayload(d), ...(pic ? { picture: pic } : {}) };
}

function nonWatchPayload(d: NonWatchDraft): Payload {
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
    case 'right_wrong':
      return { prompt: d.prompt.trim(), sentence: d.sentence.trim(), ...(d.right === null ? {} : { right: d.right }) };
  }
}

/** All the words a kid will read in a draft, for picture suggestions. */
export function draftWords(d: NonWatchDraft): string {
  switch (d.type) {
    case 'pick_one': return [d.prompt, ...d.choices].join(' ');
    case 'listen_tap': return [d.audioText, ...d.choices].join(' ');
    case 'find_fix': return [d.sentence, ...d.fixes].join(' ');
    case 'build_it': return [...d.tiles, d.prompt].join(' ');
    case 'sort_it': return [...d.items.map((i) => i.text), d.prompt].join(' ');
    case 'fill_blank': return [d.before, ...d.choices, d.after].join(' ');
    case 'right_wrong': return d.sentence;
  }
}
