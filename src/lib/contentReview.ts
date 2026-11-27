/**
 * The review list for the content pass: what changed in a lesson or bank skill, sorted by how much reading
 * it needs, and each question written out the way the editor's answer summary shows it.
 * `scripts/content-review.ts` feeds it the base (a git ref) and the working files. Pure.
 */
import { BOYS, CAST, GIRLS, PROMPT_POOLS } from '@/lib/contentPass';
import { TYPE_NAMES } from '@/lib/questions/draft';
import type { NonWatchQuestion, Question } from '@/lib/questions/schema';

export type NameChange = { from: string; to: string };
export type Renamed = { index: number; names: NameChange[]; question: Question };
/**
 * A prompt change, base → current. `hand`: written by hand after the pass (not the pass's, not from its
 * pools). `relabel`: a sort-it group label that changed with it ("Wrong" → "Not right").
 */
export type PromptChange = { from: string; to: string; hand: boolean; relabel?: NameChange };
export type Reprompted = { index: number; question: Question } & PromptChange;
export type Added = { index: number; question: Question };
/**
 * `was`: the base question (as it is in the app before the pass). `names` and `prompt`: the pass's renames
 * still in the question and any prompt change it also got. `namesOnly`: beyond the pass, only a hand rename (Mr. Park → Mr. Bell,
 * Ms. Lee → Ms. Gray, or one cast name for another), not the scene. `checkPicture`: its words changed
 * beyond the pass but its picture did not.
 */
export type Rewritten = {
  index: number; was: Question; question: Question; names: NameChange[]; prompt?: PromptChange; namesOnly: boolean; checkPicture: boolean;
};
export type Changes = { renamed: Renamed[]; reprompted: Reprompted[]; added: Added[]; rewritten: Rewritten[] };

/** Keys whose strings are not text a kid reads. */
const NOT_TEXT = new Set(['type', 'skill', 'picture', 'image', 'youtubeId']);

const sortKeys = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sortKeys)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]))
      : v;
const same = (a: unknown, b: unknown) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const field = (q: Question, k: string): unknown => (q as unknown as Record<string, unknown>)[k];
const promptOf = (q: Question) => (typeof field(q, 'prompt') === 'string' ? (field(q, 'prompt') as string) : undefined);
const without = (q: Question, ...keys: string[]) => Object.fromEntries(Object.entries(q).filter(([k]) => !keys.includes(k)));

/** Every kid-facing string of a value, in order, leaving out the top-level keys in `skip`. */
function texts(v: unknown, skip: string[] = []): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap((x) => texts(x));
  if (v && typeof v === 'object') {
    return Object.entries(v).flatMap(([k, x]) => (NOT_TEXT.has(k) || skip.includes(k) ? [] : texts(x)));
  }
  return [];
}

const OLD = new RegExp(`^(${CAST.map((c) => c.from).join('|')})s?$`, 'i');
const NEW = new RegExp(`^(${[...BOYS, ...GIRLS].join('|')})s?$`, 'i');
const words = (s: string) => s.match(/[A-Za-z]+/g) ?? [];

/**
 * The cast renames between a base question and the passed one ("Mia → Nova"), in order of appearance,
 * one per name (case-insensitively). Renames swap one word for one word, so the words line up; the prompt
 * and sort-it labels are compared on their own because rotation and relabeling change their length.
 */
function nameChanges(base: Question, passed: Question): NameChange[] {
  const chunks = (q: Question) => [promptOf(q) ?? '', ...((field(q, 'groups') as string[] | undefined) ?? []), texts(q, ['prompt', 'groups']).join(' ')];
  const b = chunks(base), p = chunks(passed);
  if (b.length !== p.length) return [];
  const out: NameChange[] = [];
  b.forEach((chunk, ci) => {
    const bw = words(chunk), pw = words(p[ci]);
    if (bw.length !== pw.length) return;
    bw.forEach((w, i) => {
      const from = w.match(OLD), to = pw[i].match(NEW);
      if (w === pw[i] || !from || !to) return;
      const pair = { from: w.slice(0, from[1].length), to: pw[i].slice(0, to[1].length) };
      if (!out.some((o) => o.from.toLowerCase() === pair.from.toLowerCase() && o.to.toLowerCase() === pair.to.toLowerCase())) out.push(pair);
    });
  });
  return out;
}

/** `text` with the name changes applied, keeping each match's first-letter case and suffix. */
function renameIn(text: string, names: NameChange[]): string {
  return names.reduce((t, n) => t.replace(new RegExp(`\\b${n.from}(?=(?:s|'s|s')?\\b)`, 'gi'), (m) =>
    (m.charAt(0) === m.charAt(0).toLowerCase() ? n.to.toLowerCase() : n.to.charAt(0).toUpperCase() + n.to.slice(1).toLowerCase())), text);
}

/** A prompt from the pass's rotation pools: a hand edit that lands on one is the rotation shifting, not new words. */
const isPoolPrompt = (type: string, prompt: string) => PROMPT_POOLS.some((p) => p.type === type && p.pool.includes(prompt));

/** People a hand rename may swap: the old and new cast (not Pip the dog or Blobby, whose arrival makes a scene silly). */
const PEOPLE = new Set([...CAST.map((c) => c.from), ...BOYS, ...GIRLS]);
/** The two teachers renamed by hand, after their title. */
const TITLE_RENAMES = [['Park', 'Bell'], ['Lee', 'Gray']];

/** Whether words `from` → `to` (lined up, equal length) differ only by people's names. */
function onlyNamesDiffer(from: string[], to: string[]): boolean {
  return from.length === to.length && from.every((w, i) => w === to[i] || (PEOPLE.has(w) && PEOPLE.has(to[i]))
    || (/^(Mr|Ms|Mrs)$/.test(from[i - 1] ?? '') && TITLE_RENAMES.some(([a, b]) => a === w && b === to[i])));
}

/** The first sort-it group label that differs between two questions. */
function relabelOf(a: Question, b: Question): NameChange | undefined {
  const ga = (field(a, 'groups') as string[] | undefined) ?? [], gb = (field(b, 'groups') as string[] | undefined) ?? [];
  const i = ga.findIndex((g, j) => g !== gb[j]);
  return i < 0 ? undefined : { from: ga[i], to: gb[i] ?? '' };
}

/** The base → current prompt change of a question, unless it is only the pass's renames. */
function promptChange(b: Question, p: Question, c: Question, names: NameChange[]): PromptChange | undefined {
  const from = promptOf(b) ?? '', to = promptOf(c) ?? '';
  const relabel = relabelOf(b, c);
  // A prompt whose only change is a name ("Ben and Tom are…") is listed under names, not prompts.
  if (renameIn(from, names) === to && !relabel) return undefined;
  return { from, to, hand: to !== promptOf(p) && !isPoolPrompt(c.type, to), ...(relabel ? { relabel } : {}) };
}

/** Keys whose values hold kid-facing text (everything else is indexes, flags and pictures). */
const TEXT_KEYS = ['prompt', 'sentence', 'before', 'after', 'audioText', 'words', 'fixes', 'tiles', 'distractors', 'groups', 'choices', 'items', 'pairs', 'questions'];

const longWords = (q: Question) => [...new Set(texts(q, ['prompt']).join(' ').toLowerCase().match(/[a-z]{4,}/g) ?? [])].sort().join(' ');

/**
 * Pairs `current` with the base by position and sorts each change: unchanged (left out); the pass's own
 * output (renamed and/or reprompted); the pass's output with a hand-written prompt (reprompted, `hand`);
 * anything else (rewritten: changed beyond the pass); positions beyond the base (added).
 * `baseAfterPass` is `applyPass(base)` with the seed and options the content-pass script uses.
 */
export function classifyChanges(baseAfterPass: Question[], current: Question[], base: Question[]): Changes {
  const out: Changes = { renamed: [], reprompted: [], added: [], rewritten: [] };
  current.forEach((c, index) => {
    if (index >= base.length) { out.added.push({ index, question: c }); return; }
    const b = base[index], p = baseAfterPass[index];
    if (same(c, b)) return;
    const names = nameChanges(b, p);
    const prompt = promptChange(b, p, c, names);
    if (same(without(c, 'prompt'), without(p, 'prompt'))) {
      if (names.length > 0) out.renamed.push({ index, names, question: c });
      if (prompt) out.reprompted.push({ index, question: c, ...prompt });
      if (names.length > 0 || prompt) return;
    }
    const namesOnly = c.type === p.type && same(without(c, ...TEXT_KEYS), without(p, ...TEXT_KEYS))
      && onlyNamesDiffer(words(texts(p, ['prompt']).join(' ')), words(texts(c, ['prompt']).join(' ')));
    const picture = field(c, 'picture');
    const checkPicture = !namesOnly && picture !== undefined && picture === field(p, 'picture') && longWords(c) !== longWords(p);
    // A pass rename the rewrite then wrote out ("Mina" → "Ruby" → "The cat") is not a name change on this question.
    const now = words(texts(c).join(' ')).map((w) => w.toLowerCase());
    const kept = names.filter((n) => now.some((w) => w === n.to.toLowerCase() || w === `${n.to.toLowerCase()}s`));
    out.rewritten.push({ index, was: b, question: c, names: kept, ...(prompt ? { prompt } : {}), namesOnly, checkPicture });
  });
  return out;
}

const mark = (text: string, right: boolean) => (right ? `✔ ${text}` : text);
const bracket = (text: string) => `[✔ ${text}]`;
const join = (...parts: string[]) => parts.filter((s) => s.trim() !== '').join(' ');

function bodyLines(q: NonWatchQuestion): string[] {
  switch (q.type) {
    case 'pick_one':
    case 'picture_first':
      return [q.prompt ?? 'Which one matches the picture?', ...q.choices.map((c, i) => `- ${mark(c, i === q.answer)}`)];
    case 'listen_tap':
      return [q.prompt, `- says: "${q.audioText}"`, ...q.choices.map((c, i) => `- ${mark(c.text, i === q.answer)}`)];
    case 'odd_one_out':
      return [q.prompt, ...q.words.map((w, i) => `- ${mark(w, i === q.answer)}`)];
    case 'fill_blank': {
      const others = q.choices.filter((_, i) => i !== q.answer);
      return [join(q.before, bracket(q.choices[q.answer]), q.after), ...(others.length ? [`- other choices: ${others.join(', ')}`] : [])];
    }
    case 'find_fix': {
      const others = q.fixes.filter((_, i) => i !== q.answer);
      const sentence = q.words.map((w, i) => (i === q.wrongIndex ? `~~${w}~~ ${bracket(q.fixes[q.answer])}` : w)).join(' ');
      return [sentence, ...(others.length ? [`- other fixes: ${others.join(', ')}`] : [])];
    }
    case 'build_it':
      return [q.prompt, `- ✔ ${q.tiles.join(' ')}`, ...(q.distractors?.length ? [`- extra tiles: ${q.distractors.join(', ')}`] : [])];
    case 'sort_it':
      return [q.prompt, ...q.groups.map((g, gi) => `- ${g}: ${q.items.filter((it) => it.group === gi).map((it) => it.text).join(', ') || '(none)'}`)];
    case 'right_wrong':
      return [q.prompt ?? 'Is this sentence right?', `- "${q.sentence}"`, `- ✔ ${q.right ? 'Right' : 'Not right'}`];
    case 'tap_all':
      return [q.prompt, `- ${q.words.map((w, i) => (q.answers.includes(i) ? bracket(w) : w)).join(' ')}`];
    case 'match_pairs':
      return [q.prompt, ...q.pairs.map((p) => `- ${p.left} → ${p.right}`)];
  }
}

function nonWatchLines(q: NonWatchQuestion): string[] {
  return [...bodyLines(q), ...(q.picture ? [`- picture: ${q.picture}`] : [])];
}

/**
 * One question as plain Markdown, the way the editor's answer summary shows it: the prompt (or the sentence)
 * on the first line, then the options as list items with the right one marked ✔, then `picture: <name>`.
 */
export function renderQuestion(q: Question): string {
  if (q.type !== 'watch_answer') return nonWatchLines(q).join('\n');
  const n = q.questions.length;
  const subs = q.questions.flatMap((sub) => nonWatchLines(sub).map((l, i) => (i === 0 ? `- ${l}` : `  ${l}`)));
  return [`Video (YouTube ${q.youtubeId}), then ${n} ${n === 1 ? 'question' : 'questions'}:`, ...subs].join('\n');
}

/** A question on one line: its rendered lines joined with " · ". */
export function questionLine(q: Question): string {
  return renderQuestion(q).split('\n').map((l) => l.replace(/^\s*- /, '')).join(' · ');
}

/** What a rewritten question was, on one line, without its prompt when the prompt is the same now. */
function wasLine(was: Question, now: Question): string {
  const line = questionLine(was);
  const prompt = promptOf(was);
  return prompt !== undefined && prompt === promptOf(now) && line.startsWith(`${prompt} · `) ? line.slice(prompt.length + 3) : line;
}

/** The pass's changes on a rewritten question, so every change is stated: "names: Mina → Ruby · prompt: X → Y". */
function alsoLine(r: Rewritten): string {
  return [
    ...(r.names.length ? [`names: ${r.names.map((n) => `${n.from} → ${n.to}`).join(', ')}`] : []),
    ...(r.prompt ? [`prompt: ${r.prompt.from} → ${r.prompt.to}`] : []),
    ...(r.prompt?.relabel ? [`box: ${r.prompt.relabel.from} → ${r.prompt.relabel.to}`] : []),
  ].join(' · ');
}

/** The right-answer sentence of a question, for the names list; the whole question when it has no single sentence. */
function sentenceOf(q: Question): string {
  switch (q.type) {
    case 'pick_one': case 'picture_first': return q.choices[q.answer];
    case 'listen_tap': return q.choices[q.answer].text;
    case 'fill_blank': return join(q.before, q.choices[q.answer], q.after);
    case 'find_fix': return q.words.map((w, i) => (i === q.wrongIndex ? q.fixes[q.answer] : w)).join(' ');
    case 'build_it': return q.tiles.join(' ');
    case 'right_wrong': return q.sentence;
    default: return questionLine(q);
  }
}

/**
 * One lesson (plan file) or skill (bank file) with its changes. `questions` and `base`, when given, are its
 * current and base questions: the prompt sequence then also shows pool prompts that stayed the same.
 */
export type ReviewGroup = { label: string; changes: Changes; questions?: Question[]; base?: Question[] };
export type ReviewCounts = { renamed: number; reprompted: number; added: number; rewritten: number; pictureChecks: number };

export function countChanges(groups: ReviewGroup[]): ReviewCounts {
  const sum = (f: (c: Changes) => number) => groups.reduce((n, g) => n + f(g.changes), 0);
  return {
    renamed: sum((c) => c.renamed.length),
    reprompted: sum((c) => c.reprompted.length),
    added: sum((c) => c.added.length),
    rewritten: sum((c) => c.rewritten.length),
    pictureChecks: sum((c) => c.rewritten.filter((r) => r.checkPicture).length),
  };
}

const cell = (s: string) => s.replace(/\|/g, '\\|');
const indent = (text: string) => text.split('\n').map((l, i) => (i === 0 ? l : `  ${l}`));
const typeName = (q: Question) => TYPE_NAMES[q.type].toLowerCase();

/** A rendered question as a list item: a bold heading, then the question's own lines indented under it. */
function item(heading: string, q: Question, extra: string[] = []): string[] {
  const [first, ...rest] = indent(renderQuestion(q));
  return [`- **${heading}** (${typeName(q)}): ${first}`, ...rest, ...extra.map((l) => `  - ${l}`)];
}

/** The three sections for one content file. */
export function renderFileReview(file: string, groups: ReviewGroup[]): string {
  const lines: string[] = [`## ${file}`, ''];

  lines.push('### Skim: names', '');
  const renamed = groups.flatMap((g) => g.changes.renamed.map((r) => ({ g, r })));
  if (renamed.length === 0) lines.push('No names changed.');
  let last = '';
  for (const { g, r } of renamed) {
    if (g.label !== last) { if (last) lines.push(''); lines.push(`**${g.label}**`, ''); last = g.label; }
    const names = r.names.map((n) => `${n.from} → ${n.to}`).join(', ');
    const sentence = sentenceOf(r.question);
    const shows = r.names.some((n) => sentence.toLowerCase().includes(n.to.toLowerCase())) ? sentence : questionLine(r.question);
    lines.push(`- Q${r.index + 1} · ${names}: ${shows}`);
  }
  lines.push('');

  lines.push('### Skim: prompts', '');
  const promptChanges = (c: Changes) => [
    ...c.reprompted, ...c.rewritten.flatMap((r) => (r.prompt ? [{ index: r.index, ...r.prompt }] : [])),
  ].sort((a, b) => a.index - b.index);
  const reprompted = groups.flatMap((g) => promptChanges(g.changes).map((r) => ({ g, r })));
  if (reprompted.length === 0) lines.push('No prompts changed.', '');
  else {
    const rows = new Map<string, { from: string; to: string; count: number }>();
    for (const { r } of reprompted) {
      const to = r.to + (r.relabel ? ` (and the box ${r.relabel.from} → ${r.relabel.to})` : '') + (r.hand ? ' (by hand)' : '');
      const key = `${r.from}\n${to}`;
      const row = rows.get(key) ?? { from: r.from, to, count: 0 };
      row.count++;
      rows.set(key, row);
    }
    lines.push('| Old prompt | New prompt | How many |', '|---|---|---|');
    for (const row of [...rows.values()].sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to))) {
      lines.push(`| ${cell(row.from)} | ${cell(row.to)} | ${row.count} |`);
    }
    lines.push('', 'The prompts in order, so you can see they take turns ("same" means it did not change):', '');
    for (const g of groups) {
      const changes = promptChanges(g.changes);
      if (changes.length === 0) continue;
      const changed = new Set(changes.map((r) => r.index));
      const sequence = (g.questions ?? []).flatMap((q, i) => {
        const prompt = promptOf(q), was = g.base?.[i];
        if (changed.has(i) || prompt === undefined || !isPoolPrompt(q.type, prompt)) return [];
        if (!was) return [{ index: i, text: `${prompt} (new)` }];
        return promptOf(was) === prompt ? [{ index: i, text: `${prompt} (same)` }] : [];
      }).concat(changes.map((r) => ({ index: r.index, text: r.to }))).sort((a, b) => a.index - b.index);
      lines.push(`- **${g.label}:** ${sequence.map((e) => `Q${e.index + 1} ${e.text}`).join(' · ')}`);
    }
    lines.push('');
  }

  lines.push('### Read: new and silly', '');
  const read = groups.filter((g) => g.changes.added.length + g.changes.rewritten.length > 0);
  if (read.length === 0) lines.push('Nothing new or rewritten.', '');
  for (const g of read) {
    lines.push(`#### ${g.label}`, '');
    const entries = [
      ...g.changes.rewritten.map((r) => ({
        index: r.index,
        lines: item(`Q${r.index + 1} ${r.namesOnly ? 'name changed' : 'silly'}`, r.question, [
          ...(r.checkPicture ? ['picture unchanged, check it'] : []),
          `was: ${wasLine(r.was, r.question)}`,
          ...(alsoLine(r) ? [alsoLine(r)] : []),
        ]),
      })),
      ...g.changes.added.map((a) => ({ index: a.index, lines: item(`Q${a.index + 1} new`, a.question) })),
    ].sort((a, b) => a.index - b.index);
    for (const e of entries) lines.push(...e.lines);
    lines.push('');
  }
  return lines.join('\n');
}
