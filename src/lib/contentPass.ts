/**
 * The content pass: pure rules that give the content files one cast (renames), rotate stock prompts
 * through fixed pools, and relabel Right/Wrong sort-its. `scripts/content-pass.ts` applies them to files.
 * Every rule is idempotent: running the pass on its own output changes nothing.
 */
import { hash32 } from '@/lib/bonus';
import type { NonWatchQuestion, Question } from '@/lib/questions/schema';

export const CAST: { from: string; to: string; pronoun: 'he' | 'she' }[] = [
  { from: 'Mia', to: 'Nova', pronoun: 'she' },
  { from: 'Mina', to: 'Ruby', pronoun: 'she' },
  { from: 'Stella', to: 'Zara', pronoun: 'she' },
  { from: 'Leo', to: 'Milo', pronoun: 'he' },
  { from: 'Ben', to: 'Otto', pronoun: 'he' },
  { from: 'Sam', to: 'Finn', pronoun: 'he' },
  { from: 'Jun', to: 'Finn', pronoun: 'he' },
  { from: 'Tom', to: 'Theo', pronoun: 'he' },
];
export const BOYS = ['Milo', 'Otto', 'Finn', 'Theo'];
export const GIRLS = ['Nova', 'Ruby', 'Zara'];

const SUFFIX = "(s|'s|s')?";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stemRe = (names: string[], flags: string) =>
  new RegExp(`\\b(${[...names].sort((a, b) => b.length - a.length).map(escape).join('|')})${SUFFIX}\\b`, flags);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const withCaseOf = (orig: string, target: string) =>
  orig.charAt(0) === orig.charAt(0).toLowerCase() ? target.charAt(0).toLowerCase() + target.slice(1) : target;

/**
 * Renames every whole-word stem of a name in `map` (keys capitalized, e.g. "Mia" → "Nova"), keeping the
 * suffix (s, 's, s') and the case of the first letter. A lowercase match is renamed only when `hasCapital(name)`.
 */
export function renameText(text: string, map: Map<string, string>, hasCapital: (name: string) => boolean): string {
  if (map.size === 0) return text;
  return text.replace(stemRe([...map.keys()], 'gi'), (m: string, name: string, suffix: string | undefined) => {
    const key = capitalize(name);
    const to = map.get(key);
    if (to === undefined) return m;
    const lower = name.charAt(0) !== name.charAt(0).toUpperCase();
    if (lower && !hasCapital(key)) return m;
    return withCaseOf(name, to) + (suffix ?? '');
  });
}

/** Applies `f` to every kid-facing string of a question (not ids, pictures or listen_tap images). */
function mapStrings<Q extends Question | NonWatchQuestion>(q: Q, f: (s: string) => string): Q {
  const out: Record<string, unknown> = { ...q };
  const list = (v: unknown) => (Array.isArray(v) ? v.map((s) => (typeof s === 'string' ? f(s) : s)) : v);
  for (const k of ['prompt', 'sentence', 'before', 'after', 'audioText'] as const) {
    if (typeof out[k] === 'string') out[k] = f(out[k] as string);
  }
  for (const k of ['words', 'fixes', 'tiles', 'distractors', 'groups'] as const) if (k in out) out[k] = list(out[k]);
  if (Array.isArray(out.choices)) {
    out.choices = (out.choices as unknown[]).map((c) =>
      typeof c === 'string' ? f(c) : c && typeof c === 'object' ? { ...(c as object), text: f((c as { text: string }).text) } : c);
  }
  if (Array.isArray(out.items)) out.items = (out.items as { text: string }[]).map((i) => ({ ...i, text: f(i.text) }));
  if (Array.isArray(out.pairs)) out.pairs = (out.pairs as { left: string; right: string }[]).map((p) => ({ ...p, left: f(p.left), right: f(p.right) }));
  if (q.type === 'watch_answer') out.questions = q.questions.map((iq) => mapStrings(iq, f));
  return out as Q;
}

function stringsOf(q: Question | NonWatchQuestion): string[] {
  const all: string[] = [];
  mapStrings(q, (s) => (all.push(s), s));
  return all;
}

/**
 * Renames the old cast in every string of the question. The per-question map is resolved first over all
 * strings (in order of first appearance); when two originals would map to one target, the second takes
 * the next unused name of the same pronoun. With `lowercaseNames` (capital-letter exercises), a lowercase
 * name is renamed even when the capitalized name is not in the question ("leo" → "milo").
 */
export function renameQuestion(q: NonWatchQuestion | Question, options: { lowercaseNames?: boolean } = {}): Question {
  const strings = stringsOf(q);
  const hasCapital = (name: string) => !!options.lowercaseNames || strings.some((s) => stemRe([name], '').test(s));
  const found: { name: string; at: number }[] = [];
  CAST.forEach(({ from }) => {
    let at = Infinity;
    strings.forEach((s, si) => {
      for (const m of s.matchAll(stemRe([from], 'gi'))) {
        const lower = m[1].charAt(0) !== m[1].charAt(0).toUpperCase();
        if (!lower || hasCapital(from)) at = Math.min(at, si * 1e6 + (m.index ?? 0));
      }
    });
    if (at !== Infinity) found.push({ name: from, at });
  });
  if (found.length === 0) return q as Question;
  found.sort((a, b) => a.at - b.at);
  const used = new Set([...BOYS, ...GIRLS].filter((n) => strings.some((s) => stemRe([n], options.lowercaseNames ? 'i' : '').test(s))));
  const map = new Map<string, string>();
  for (const { name } of found) {
    const { to, pronoun } = CAST.find((c) => c.from === name)!;
    const names = pronoun === 'he' ? BOYS : GIRLS;
    let target = to;
    if (used.has(target)) {
      const start = names.indexOf(to);
      for (let i = 1; i < names.length; i++) {
        const n = names[(start + i) % names.length];
        if (!used.has(n)) { target = n; break; }
      }
    }
    used.add(target);
    map.set(name, target);
  }
  return mapStrings(q, (s) => renameText(s, map, hasCapital)) as Question;
}

export const PROMPT_POOLS: { type: 'pick_one' | 'build_it' | 'sort_it'; stock: string[]; pool: string[] }[] = [
  {
    type: 'pick_one',
    stock: ['Which sentence is right?', 'Pick the right sentence.', 'Pick the right sentences.', 'Which one is written the right way?'],
    pool: [
      'Which one is right?',
      'Pick the sentence that sounds right.',
      'A robot wrote these. Which one is right?',
      'Which one would your teacher write?',
      'Tap the sentence with no mistakes.',
      'One of these is right. Tap it.',
      'Which sentence is right?',
    ],
  },
  {
    type: 'build_it',
    stock: ['Build the sentence.'],
    pool: ['Build the sentence.', 'Put the words in order.', 'Make a sentence from the tiles.', 'Tap the tiles in order.', 'What does this say? Put it in order.', 'Build it!'],
  },
  { type: 'sort_it', stock: ['Sort the words.'], pool: ['Sort the words.', 'Put each word in its box.', 'Where does each one go?', 'Sort them out.'] },
  { type: 'sort_it', stock: ['Sort the sentences.'], pool: ['Sort the sentences.', 'Put each sentence in its box.', 'Where does each sentence go?'] },
];

const RIGHT_PROMPT = 'Which ones are right? Sort them.';

/** Sort-its with a "Wrong" group get "Not right" (case as the "Right" label) and the "Which ones are right?" prompt. */
export function relabelRightWrong(q: Question): Question {
  if (q.type !== 'sort_it') return q;
  const wrongAt = q.groups.findIndex((g) => /^wrong$/i.test(g.trim()));
  const needsPeriod = q.groups.some((g) => /^right$/i.test(g.trim())) && q.groups.some((g) => /^needs a period$/i.test(g.trim()));
  if (wrongAt < 0 && !needsPeriod) return q;
  let groups = q.groups;
  if (wrongAt >= 0) {
    const right = q.groups.find((g) => /^right$/i.test(g.trim())) ?? q.groups[wrongAt];
    const label = right.trim().charAt(0) === right.trim().charAt(0).toUpperCase() ? 'Not right' : 'not right';
    groups = q.groups.map((g, i) => (i === wrongAt ? label : g));
  }
  return { ...q, prompt: RIGHT_PROMPT, groups };
}

/**
 * Rotates stock prompts within one lesson or bank skill: each pool's members (stock ∪ pool) are reassigned
 * in sequence, starting at `hash32(seed) % pool.length`, so consecutive ones never repeat and a second run
 * reassigns the same prompts. Only `prompt` changes. Pool members that are not stock rotate too: that is
 * deliberate, so the pass recognizes its own output and running it twice equals running it once.
 */
export function rotatePrompts(questions: Question[], seed: string): Question[] {
  const members = PROMPT_POOLS.map((p) => new Set([...p.stock, ...p.pool]));
  // The pools of one type are disjoint, so a prompt names its pool.
  const poolOf = (q: Question) =>
    'prompt' in q && typeof q.prompt === 'string' ? PROMPT_POOLS.findIndex((p, i) => p.type === q.type && members[i].has(q.prompt as string)) : -1;
  const offset = hash32(seed);
  const counter = PROMPT_POOLS.map(() => 0);
  return questions.map((q) => {
    const i = poolOf(q);
    if (i < 0) return q;
    const { pool } = PROMPT_POOLS[i];
    const to = pool[(offset + counter[i]++) % pool.length];
    return to === (q as { prompt: string }).prompt ? q : ({ ...q, prompt: to } as Question);
  });
}

/** Skills whose exercises put names in lowercase on purpose; their lowercase names are renamed too. */
export const LOWERCASE_NAME_SKILLS = new Set(['capitals-names', 'sentence-ends']);

/** rename → relabel → rotate. Idempotent. */
export function applyPass(questions: Question[], seed: string, options: { lowercaseNames?: boolean } = {}): Question[] {
  return rotatePrompts(questions.map((q) => relabelRightWrong(renameQuestion(q, options))), seed);
}

/** A question as stored in a content file: the payload plus an optional `skill` the schema does not know. */
export type RawQuestion = { type: string; skill?: string } & Record<string, unknown>;

/**
 * Runs the pass on content-file questions: strips `skill`, transforms, re-attaches it as the second key
 * (type, skill, then the payload in its original order), and counts the questions each rule changed.
 * A question's skill is its own `skill` field, else `groupSkill` (a bank file's skill key).
 */
export function passRawQuestions(raw: RawQuestion[], seed: string, groupSkill?: string): { questions: RawQuestion[]; renamed: number; relabeled: number; rotated: number } {
  const skills = raw.map((q) => q.skill);
  const plain = raw.map(({ skill: _skill, ...q }) => q as unknown as Question);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const renamedQs = plain.map((q, i) => renameQuestion(q, { lowercaseNames: LOWERCASE_NAME_SKILLS.has(skills[i] ?? groupSkill ?? '') }));
  const relabeledQs = renamedQs.map(relabelRightWrong);
  const rotatedQs = rotatePrompts(relabeledQs, seed);
  const changed = (a: Question[], b: Question[]) => a.filter((q, i) => !same(q, b[i])).length;
  const questions = rotatedQs.map((q, i) => {
    const { type, ...rest } = q as unknown as RawQuestion;
    return (skills[i] === undefined ? { type, ...rest } : { type, skill: skills[i], ...rest }) as RawQuestion;
  });
  return { questions, renamed: changed(plain, renamedQs), relabeled: changed(renamedQs, relabeledQs), rotated: changed(relabeledQs, rotatedQs) };
}

/**
 * The groups the pass rotates within, for a parsed content file: a bank file's skills (seed and skill = the
 * skill key) or a plan file's lessons (seed = lesson title; each question carries its own `skill`).
 * `label` names the group for people ("skill be", "Week 1 · Add -ed the right way").
 */
export function contentGroups(data: unknown): { where: string; label: string; seed: string; skill?: string; get: () => RawQuestion[]; set: (qs: RawQuestion[]) => void }[] {
  const d = data as { skills?: Record<string, RawQuestion[]>; weeks?: { lessons: { title: string; questions: RawQuestion[] }[] }[] };
  if (d && typeof d === 'object' && d.skills && !d.weeks) {
    const skills = d.skills;
    return Object.keys(skills).map((key) => ({ where: `skill ${key}`, label: `Skill: ${key}`, seed: key, skill: key, get: () => skills[key], set: (qs) => { skills[key] = qs; } }));
  }
  return d.weeks!.flatMap((week, wi) => week.lessons.map((lesson) => ({
    where: `lesson "${lesson.title}"`, label: `Week ${wi + 1} · ${lesson.title}`, seed: lesson.title,
    get: () => lesson.questions, set: (qs: RawQuestion[]) => { lesson.questions = qs; },
  })));
}
