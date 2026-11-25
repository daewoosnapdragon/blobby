import { YOUTUBE_ID_RE } from '@/lib/youtube';
import { z } from 'zod';

/**
 * Question shape: flat `{ type, ...payload }` (discriminated on `type`).
 * Per-type payload types are exported without `type`; `parseQuestion(type, payload)`
 * is what the DB layer calls (wp_questions stores `type` + `payload` jsonb).
 */

const text = z.string().trim().min(1, 'must not be empty');
const idx = z.number().int().min(0);

/**
 * Form for "is this the same text?" checks: trimmed, inner spaces collapsed. Case-SENSITIVE on purpose:
 * capitalization is a skill we teach ("i" vs "I", "monday." vs "Monday."), so those are different answers.
 */
const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Adds one issue per repeated text, at the repeat's index: "is the same as {noun} {first}". */
function noRepeats(ctx: z.RefinementCtx, texts: string[], field: string, noun: string) {
  const first = new Map<string, number>();
  texts.forEach((t, i) => {
    const k = norm(t);
    if (k === '') return; // already "fill this in"
    const j = first.get(k);
    if (j === undefined) first.set(k, i);
    else ctx.addIssue({ code: 'custom', message: `is the same as ${noun} ${j + 1}`, path: [field, i] });
  });
}

const listenTapPayload = z
  .object({
    prompt: text,
    audioText: text,
    choices: z.array(z.object({ text, image: z.string().trim().min(1).optional() })).min(2),
    answer: idx,
  })
  .refine((q) => q.answer < q.choices.length, { message: 'answer is out of range of choices', path: ['answer'] })
  .superRefine((q, ctx) => noRepeats(ctx, q.choices.map((c) => c.text), 'choices', 'choice'));

const pickOnePayload = z
  .object({ prompt: text, choices: z.array(text).min(2).max(4), answer: idx })
  .refine((q) => q.answer < q.choices.length, { message: 'answer is out of range of choices', path: ['answer'] })
  .superRefine((q, ctx) => noRepeats(ctx, q.choices, 'choices', 'choice'));

const findFixPayload = z
  .object({ words: z.array(text).min(1), wrongIndex: idx, fixes: z.array(text).min(2), answer: idx })
  .refine((q) => q.wrongIndex < q.words.length, { message: 'wrongIndex is out of range of words', path: ['wrongIndex'] })
  .refine((q) => q.answer < q.fixes.length, { message: 'answer is out of range of fixes', path: ['answer'] })
  .superRefine((q, ctx) => {
    const wrong = q.words[q.wrongIndex];
    q.fixes.forEach((f, i) => {
      if (wrong !== undefined && norm(f) !== '' && norm(f) === norm(wrong)) {
        ctx.addIssue({ code: 'custom', message: 'is the same as the wrong word', path: ['fixes', i] });
      }
    });
    noRepeats(ctx, q.fixes, 'fixes', 'fix');
  });

const buildItPayload = z
  .object({
    prompt: text,
    tiles: z.array(text).min(2, 'needs at least 2 tiles'),
    distractors: z.array(text).optional(),
  })
  .superRefine((q, ctx) => {
    const tiles = new Set(q.tiles.map(norm));
    (q.distractors ?? []).forEach((d, i) => {
      if (norm(d) !== '' && tiles.has(norm(d))) ctx.addIssue({ code: 'custom', message: 'is the same as a tile', path: ['distractors', i] });
    });
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
  })
  .superRefine((q, ctx) => noRepeats(ctx, q.items.map((i) => i.text), 'items', 'word'));

const fillBlankPayload = z
  .object({ before: z.string(), after: z.string(), choices: z.array(text).min(2), answer: idx })
  .refine((q) => q.before.trim() !== '' || q.after.trim() !== '', { message: 'before and after cannot both be empty', path: ['before'] })
  .refine((q) => q.answer < q.choices.length, { message: 'answer is out of range of choices', path: ['answer'] })
  .superRefine((q, ctx) => noRepeats(ctx, q.choices, 'choices', 'choice'));

const listenTapQ = listenTapPayload.extend({ type: z.literal('listen_tap') });
const pickOneQ = pickOnePayload.extend({ type: z.literal('pick_one') });
const findFixQ = findFixPayload.extend({ type: z.literal('find_fix') });
const buildItQ = buildItPayload.extend({ type: z.literal('build_it') });
const sortItQ = sortItPayload.extend({ type: z.literal('sort_it') });
const fillBlankQ = fillBlankPayload.extend({ type: z.literal('fill_blank') });

const nonWatchSchema = z.discriminatedUnion('type', [listenTapQ, pickOneQ, findFixQ, buildItQ, sortItQ, fillBlankQ]);

const watchAnswerPayload = z.object({
  youtubeId: z.string().trim().regex(YOUTUBE_ID_RE, 'needs an 11-character YouTube id'),
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
