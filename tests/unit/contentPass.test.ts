import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Question } from '@/lib/questions/schema';
import {
  CAST, BOYS, GIRLS, PROMPT_POOLS, applyPass, passRawQuestions, relabelRightWrong, renameQuestion, renameText, rotatePrompts,
  type RawQuestion,
} from '@/lib/contentPass';

type PickOne = Extract<Question, { type: 'pick_one' }>;
type SortIt = Extract<Question, { type: 'sort_it' }>;
const PICK_POOL = PROMPT_POOLS.find((p) => p.type === 'pick_one')!.pool;

const pick = (prompt: string): PickOne => ({ type: 'pick_one', prompt, choices: ['a', 'b'], answer: 0 });
const pickWithChoices = (choices: string[], prompt = 'Which sentence is about it?'): PickOne => ({ type: 'pick_one', prompt, choices, answer: 0 });
const sortIt = (prompt: string, groups: string[]): SortIt => ({ type: 'sort_it', prompt, groups, items: [{ text: 'x', group: 0 }, { text: 'y', group: 1 }] });

describe('content pass: cast', () => {
  it('has the cast from the constraints', () => {
    expect(CAST).toEqual([
      { from: 'Mia', to: 'Nova', pronoun: 'she' },
      { from: 'Mina', to: 'Ruby', pronoun: 'she' },
      { from: 'Stella', to: 'Zara', pronoun: 'she' },
      { from: 'Leo', to: 'Milo', pronoun: 'he' },
      { from: 'Ben', to: 'Otto', pronoun: 'he' },
      { from: 'Sam', to: 'Finn', pronoun: 'he' },
      { from: 'Jun', to: 'Finn', pronoun: 'he' },
      { from: 'Tom', to: 'Theo', pronoun: 'he' },
    ]);
    expect(BOYS).toEqual(['Milo', 'Otto', 'Finn', 'Theo']);
    expect(GIRLS).toEqual(['Nova', 'Ruby', 'Zara']);
  });
  it('renameText renames whole-word stems from the map', () => {
    expect(renameText("Leo's hat and Leos", new Map([['Leo', 'Milo']]), () => true)).toBe("Milo's hat and Milos");
    expect(renameText('leo and Leon', new Map([['Leo', 'Milo']]), () => false)).toBe('leo and Leon');
    expect(renameText('leo', new Map([['Leo', 'Milo']]), () => true)).toBe('milo');
  });
});

describe('content pass: rename', () => {
  it('renames whole-word stems, keeps case and possessives, leaves lowercase alone unless the capital is present', () => {
    expect(renameQuestion(pick("Mia's bag is red. Mia likes it."))).toMatchObject({ prompt: "Nova's bag is red. Nova likes it." });
    expect(renameQuestion(pickWithChoices(['mina is my friend.', 'Mina is my friend.']))).toMatchObject({ choices: ['ruby is my friend.', 'Ruby is my friend.'] });
    expect(renameQuestion(pickWithChoices(['Mias bag', "Mia's bag"]))).toMatchObject({ choices: ['Novas bag', "Nova's bag"] });
    expect(renameQuestion(pickWithChoices(["Toms'", "Tom's"]))).toMatchObject({ choices: ["Theos'", "Theo's"] });
    expect(renameQuestion(pick('sam went home.'))).toMatchObject({ prompt: 'sam went home.' });
    expect(renameQuestion(pick('the same word'))).toMatchObject({ prompt: 'the same word' });
  });
  it('collision: Sam and Jun in one question become two different boys (Review Focus 1)', () => {
    const r = renameQuestion(pick('Sam and Jun are brothers. He likes Jun.')) as PickOne;
    expect(r.prompt).toBe('Finn and Theo are brothers. He likes Theo.');
  });
  it('resolves the mapping over all strings of the question', () => {
    const r = renameQuestion(pickWithChoices(['Jun is here.', 'Sam is here.'], 'Who is here, Sam?')) as PickOne;
    // Sam appears first (in the prompt) and takes Finn; Jun takes the next unused boy everywhere.
    expect(r).toMatchObject({ prompt: 'Who is here, Finn?', choices: ['Theo is here.', 'Finn is here.'] });
  });
  it('renames every string field, including list items, pairs, listen_tap choice texts and watch_answer questions', () => {
    const q: Question = {
      type: 'watch_answer', youtubeId: 'abcdefghijk',
      questions: [
        { type: 'listen_tap', prompt: 'Tap Ben.', audioText: 'Ben', choices: [{ text: 'Ben', image: 'Ben.png' }, { text: 'Tom' }], answer: 0 },
        { type: 'sort_it', prompt: 'Sort.', groups: ['Leo', 'Mia'], items: [{ text: "Leo's cat", group: 0 }] },
        { type: 'match_pairs', prompt: 'Match.', pairs: [{ left: 'Stella', right: 'Stella runs.' }, { left: 'a', right: 'b' }] },
        { type: 'fill_blank', before: 'Tom', after: 'is here, Tom.', choices: ['is', 'are'], answer: 0 },
        { type: 'find_fix', words: ['Mina', 'run'], wrongIndex: 1, fixes: ['runs', 'Mina runs'], answer: 0 },
        { type: 'build_it', prompt: 'Build.', tiles: ['Ben', 'runs.'], distractors: ['Bens'] },
        { type: 'right_wrong', prompt: 'Right?', sentence: 'Jun runs.', right: true },
      ],
    };
    expect(renameQuestion(q)).toEqual({
      type: 'watch_answer', youtubeId: 'abcdefghijk',
      questions: [
        { type: 'listen_tap', prompt: 'Tap Otto.', audioText: 'Otto', choices: [{ text: 'Otto', image: 'Ben.png' }, { text: 'Theo' }], answer: 0 },
        { type: 'sort_it', prompt: 'Sort.', groups: ['Milo', 'Nova'], items: [{ text: "Milo's cat", group: 0 }] },
        { type: 'match_pairs', prompt: 'Match.', pairs: [{ left: 'Zara', right: 'Zara runs.' }, { left: 'a', right: 'b' }] },
        { type: 'fill_blank', before: 'Theo', after: 'is here, Theo.', choices: ['is', 'are'], answer: 0 },
        { type: 'find_fix', words: ['Ruby', 'run'], wrongIndex: 1, fixes: ['runs', 'Ruby runs'], answer: 0 },
        { type: 'build_it', prompt: 'Build.', tiles: ['Otto', 'runs.'], distractors: ['Ottos'] },
        { type: 'right_wrong', prompt: 'Right?', sentence: 'Finn runs.', right: true },
      ],
    });
  });
  it('a new-cast name already in the question counts as used (Mia and Nova → Ruby and Nova)', () => {
    expect(renameQuestion(pick('Mia and Nova are sisters.'))).toMatchObject({ prompt: 'Ruby and Nova are sisters.' });
  });
  it('is a no-op when no old names remain', () => {
    const q = pick('Finn and Theo are brothers.');
    expect(renameQuestion(q)).toEqual(q);
  });
});

describe('content pass: rotate and relabel', () => {
  it('rotates only stock prompts, never choices (Review Focus 2), never repeats consecutively, deterministic and idempotent', () => {
    const qs = [pick('Which sentence is right?'), pick('Which sentence is right?'), pick('Which sentence is about yesterday?'), pickWithChoices(['Which sentence is right?', 'x'], 'Pick the right sentence.')];
    const once = rotatePrompts(qs, 'Yesterday'); const twice = rotatePrompts(once, 'Yesterday');
    expect((once[0] as PickOne).prompt).not.toBe((once[1] as PickOne).prompt);
    expect(PICK_POOL).toContain((once[0] as PickOne).prompt);
    expect((once[2] as PickOne).prompt).toBe('Which sentence is about yesterday?');
    expect((once[3] as PickOne).choices).toEqual(['Which sentence is right?', 'x']);
    expect(twice).toEqual(once);
    expect(rotatePrompts(qs, 'Yesterday')).toEqual(once);
  });
  it('starts each pool at hash32(seed) % pool length and keeps the sort pools apart', () => {
    const words = PROMPT_POOLS.find((p) => p.stock.includes('Sort the words.'))!.pool;
    const sentences = PROMPT_POOLS.find((p) => p.stock.includes('Sort the sentences.'))!.pool;
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const qs = [sortIt('Sort the words.', ['x', 'y']), sortIt('Sort the sentences.', ['x', 'y']), sortIt('Sort the words.', ['x', 'y']), sortIt('Sort the sentences.', ['x', 'y'])];
      const once = rotatePrompts(qs, seed) as SortIt[];
      expect(words).toContain(once[0].prompt); expect(words).toContain(once[2].prompt);
      expect(sentences).toContain(once[1].prompt); expect(sentences).toContain(once[3].prompt);
      expect(once[0].prompt).not.toBe(once[2].prompt);
      expect(once[1].prompt).not.toBe(once[3].prompt);
      expect(rotatePrompts(once, seed)).toEqual(once);
    }
  });
  it('the two sort pools are disjoint, and mixed sort stocks are idempotent with no consecutive repeat for 200 seeds', () => {
    const sortPools = PROMPT_POOLS.filter((p) => p.type === 'sort_it');
    expect(sortPools[0].pool.filter((x) => sortPools[1].pool.includes(x))).toEqual([]);
    const W = 'Sort the words.', S = 'Sort the sentences.';
    const orders = [[S, S, W, W], [W, W, S, S], [W, S, W, S], [S, W, S, W], [W, S, S, W, W, S, W, S, S], [S, S, S, W, W, W, W, S]];
    for (let n = 0; n < 200; n++) {
      const seed = `s${n}`;
      for (const order of orders) {
        const once = rotatePrompts(order.map((p) => sortIt(p, ['x', 'y'])), seed) as SortIt[];
        expect(rotatePrompts(once, seed)).toEqual(once);
        for (const stock of [W, S]) {
          const pool = sortPools.find((p) => p.stock.includes(stock))!.pool;
          const mine = once.filter((_, i) => order[i] === stock).map((q) => q.prompt);
          mine.forEach((p, i) => { expect(pool).toContain(p); if (i > 0) expect(p).not.toBe(mine[i - 1]); });
        }
      }
    }
  });
  it('relabels Right/Wrong sort-its and sets their prompt', () => {
    expect(relabelRightWrong(sortIt('Right or wrong?', ['Right', 'Wrong']))).toMatchObject({ prompt: 'Which ones are right? Sort them.', groups: ['Right', 'Not right'] });
    expect(relabelRightWrong(sortIt('Is the sentence right?', ['right', 'wrong']))).toMatchObject({ groups: ['right', 'not right'] });
    expect(relabelRightWrong(sortIt('Sort the words.', ['Right', 'Needs a period']))).toMatchObject({ prompt: 'Which ones are right? Sort them.', groups: ['Right', 'Needs a period'] });
    const other = sortIt('Sort the words.', ['is', 'are']);
    expect(relabelRightWrong(other)).toEqual(other);
  });
  it('applyPass relabels before rotating, so a relabeled sort-it keeps its new prompt', () => {
    const [q] = applyPass([sortIt('Sort the sentences.', ['Right', 'Wrong'])], 'x') as SortIt[];
    expect(q).toMatchObject({ prompt: 'Which ones are right? Sort them.', groups: ['Right', 'Not right'] });
  });
});

describe('content pass: real content', () => {
  it('applyPass on a copy of content/test-week-g1.json keeps every type, skill, answer and picture, and is idempotent', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'test-week-g1.json'), 'utf8'));
    const answerOf = (q: Record<string, unknown>) => JSON.stringify([q.answer, q.answers, q.wrongIndex, q.right, (q.items as { group: number }[] | undefined)?.map((i) => i.group)]);
    const counts = (q: Record<string, unknown>) => ['choices', 'words', 'fixes', 'tiles', 'distractors', 'items', 'groups', 'pairs', 'questions']
      .map((k) => (Array.isArray(q[k]) ? (q[k] as unknown[]).length : -1));
    let n = 0;
    for (const week of raw.weeks) for (const lesson of week.lessons) {
      const before: RawQuestion[] = lesson.questions;
      const { questions: after } = passRawQuestions(before, lesson.title);
      expect(after).toHaveLength(before.length);
      after.forEach((a, i) => {
        const b = before[i] as Record<string, unknown>; const x = a as Record<string, unknown>;
        expect(Object.keys(x).slice(0, 2)).toEqual(Object.keys(b).slice(0, 2));
        expect(x.type).toBe(b.type);
        expect(x.skill).toBe(b.skill);
        expect(answerOf(x)).toBe(answerOf(b));
        expect(x.picture).toBe(b.picture);
        expect(counts(x)).toEqual(counts(b));
        n++;
      });
      expect(passRawQuestions(after, lesson.title).questions).toEqual(after);
      expect(applyPass(after.map(({ skill: _s, ...q }) => q as Question), lesson.title)).toEqual(after.map(({ skill: _s, ...q }) => q));
    }
    expect(n).toBeGreaterThan(0);
  });
});
