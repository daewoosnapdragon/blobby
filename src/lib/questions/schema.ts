import { z } from 'zod';

/**
 * Question shape: flat `{ type, ...payload }` (discriminated on `type`).
 * Per-type payload types are exported without `type`; `parseQuestion(type, payload)`
 * is what the DB layer calls (wp_questions stores `type` + `payload` jsonb).
 */

const text = z.string().trim().min(1, 'must not be empty');
const idx = z.number().int().min(0);

const listenTapPayload = z
  .object({
    prompt: text,
    audioText: text,
    choices: z.array(z.object({ text, image: z.string().trim().min(1).optional() })).min(2),
    answer: idx,
  })
  .refine((q) => q.answer < q.choices.length, { message: 'answer is out of range of choices', path: ['answer'] });

const pickOnePayload = z
  .object({ prompt: text, choices: z.array(text).min(2).max(4), answer: idx })
  .refine((q) => q.answer < q.choices.length, { message: 'answer is out of range of choices', path: ['answer'] });

const findFixPayload = z
  .object({ words: z.array(text).min(1), wrongIndex: idx, fixes: z.array(text).min(2), answer: idx })
  .refine((q) => q.wrongIndex < q.words.length, { message: 'wrongIndex is out of range of words', path: ['wrongIndex'] })
  .refine((q) => q.answer < q.fixes.length, { message: 'answer is out of range of fixes', path: ['answer'] });

const buildItPayload = z.object({
  prompt: text,
  tiles: z.array(text).min(2, 'needs at least 2 tiles'),
  distractors: z.array(text).optional(),
});

const sortItPayload = z
  .object({
    prompt: text,
    groups: z.array(text).min(2),
    items: z.array(z.object({ text, group: idx })).min(1),
  })
  .refine((q) => q.items.every((i) => i.group < q.groups.length), {
    message: 'item group is out of range of groups',
    path: ['items'],
  });

const fillBlankPayload = z
  .object({ before: z.string(), after: z.string(), choices: z.array(text).min(2), answer: idx })
  .refine((q) => q.before.trim() !== '' || q.after.trim() !== '', { message: 'before and after cannot both be empty', path: ['before'] })
  .refine((q) => q.answer < q.choices.length, { message: 'answer is out of range of choices', path: ['answer'] });

const listenTapQ = listenTapPayload.extend({ type: z.literal('listen_tap') });
const pickOneQ = pickOnePayload.extend({ type: z.literal('pick_one') });
const findFixQ = findFixPayload.extend({ type: z.literal('find_fix') });
const buildItQ = buildItPayload.extend({ type: z.literal('build_it') });
const sortItQ = sortItPayload.extend({ type: z.literal('sort_it') });
const fillBlankQ = fillBlankPayload.extend({ type: z.literal('fill_blank') });

const nonWatchSchema = z.discriminatedUnion('type', [listenTapQ, pickOneQ, findFixQ, buildItQ, sortItQ, fillBlankQ]);

const watchAnswerPayload = z.object({
  youtubeId: text,
  questions: z.array(nonWatchSchema).min(1, 'needs at least 1 question'),
});
const watchAnswerQ = watchAnswerPayload.extend({ type: z.literal('watch_answer') });

export const questionSchema = z.discriminatedUnion('type', [
  listenTapQ, pickOneQ, findFixQ, buildItQ, sortItQ, fillBlankQ, watchAnswerQ,
]);

const payloadSchemas = {
  listen_tap: listenTapPayload,
  pick_one: pickOnePayload,
  find_fix: findFixPayload,
  build_it: buildItPayload,
  sort_it: sortItPayload,
  fill_blank: fillBlankPayload,
  watch_answer: watchAnswerPayload,
} as const;

export type QuestionType = keyof typeof payloadSchemas;
export const QUESTION_TYPES = Object.keys(payloadSchemas) as QuestionType[];

export type ListenTapPayload = z.infer<typeof listenTapPayload>;
export type PickOnePayload = z.infer<typeof pickOnePayload>;
export type FindFixPayload = z.infer<typeof findFixPayload>;
export type BuildItPayload = z.infer<typeof buildItPayload>;
export type SortItPayload = z.infer<typeof sortItPayload>;
export type FillBlankPayload = z.infer<typeof fillBlankPayload>;
export type WatchAnswerPayload = z.infer<typeof watchAnswerPayload>;

export type NonWatchQuestion = z.infer<typeof nonWatchSchema>;
export type Question = z.infer<typeof questionSchema>;

export type Response =
  | { choice: number }
  | { tapped: number; fix: number }
  | { order: string[] }
  | { placement: number[] };

export function isQuestionType(t: unknown): t is QuestionType {
  return typeof t === 'string' && Object.hasOwn(payloadSchemas, t);
}

/** Validates `payload` for `type` and returns `{ type, ...payload }`. Throws a readable Error. */
export function parseQuestion(type: string, payload: unknown): Question {
  if (!isQuestionType(type)) throw new Error(`Unknown question type: ${JSON.stringify(type)}`);
  const body = payload && typeof payload === 'object' ? { ...(payload as object), type } : { type };
  const r = questionSchema.safeParse(body);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`Invalid ${type} question: ${msg}`);
  }
  return r.data;
}
