import { describe, it, expect } from 'vitest';
import type { Question } from '@/lib/questions/schema';
import { applyPass } from '@/lib/contentPass';
import { classifyChanges, countChanges, renderFileReview, renderQuestion } from '@/lib/contentReview';

const SEED = 'A lesson';
const pick = (prompt: string, choices: string[], answer = 0, picture?: string): Question =>
  ({ type: 'pick_one', prompt, choices, answer, ...(picture ? { picture } : {}) }) as Question;
const blank = (before: string, after: string, choices: string[], answer = 0, picture?: string): Question =>
  ({ type: 'fill_blank', before, after, choices, answer, ...(picture ? { picture } : {}) }) as Question;

/** Runs the pass like the script does and classifies `current` against it. */
const classify = (base: Question[], current: Question[]) => classifyChanges(applyPass(base, SEED), current, base);

describe('classifyChanges', () => {
  it('leaves unchanged questions out', () => {
    const base = [blank('I', 'happy.', ['am', 'is'])];
    expect(classify(base, base)).toEqual({ renamed: [], reprompted: [], added: [], rewritten: [] });
  });

  it('a renamed question: names only, with the name pairs', () => {
    const base = [blank('Mia and Leo', "at Mia's house.", ['play', 'plays'])];
    const passed = applyPass(base, SEED);
    const r = classify(base, passed);
    expect(r.renamed).toEqual([{ index: 0, names: [{ from: 'Mia', to: 'Nova' }, { from: 'Leo', to: 'Milo' }], question: passed[0] }]);
    expect(r.reprompted).toEqual([]);
    expect(r.rewritten).toEqual([]);
  });

  it('a reprompted question (rotation) is listed with old and new prompt; a renamed one in both lists', () => {
    const base = [pick('Pick the right sentence.', ['I am.', 'I is.']), pick('Pick the right sentence.', ['Ben is.', 'Ben am.'])];
    const passed = applyPass(base, SEED);
    expect(passed[0]).not.toEqual(base[0]);
    const r = classify(base, passed);
    expect(r.reprompted.map((x) => x.index)).toEqual([0, 1]);
    expect(r.reprompted[0]).toMatchObject({ from: 'Pick the right sentence.', to: (passed[0] as { prompt: string }).prompt, hand: false });
    expect(r.renamed).toEqual([{ index: 1, names: [{ from: 'Ben', to: 'Otto' }], question: passed[1] }]);
  });

  it('the Wrong → Not right relabel counts as reprompted and says so', () => {
    const base: Question[] = [{ type: 'sort_it', prompt: 'Sort the sentences.', groups: ['Right', 'Wrong'], items: [{ text: 'I am.', group: 0 }, { text: 'I is.', group: 1 }] }];
    const r = classify(base, applyPass(base, SEED));
    expect(r.reprompted).toEqual([expect.objectContaining({ index: 0, from: 'Sort the sentences.', to: 'Which ones are right? Sort them.', relabeled: true })]);
  });

  it('a hand-reprompted question: differs from the passed one only in its prompt', () => {
    const base = [pick('Pick the right sentence.', ['Mia went to Ohio.', 'mia went to ohio.'])];
    const passed = applyPass(base, SEED);
    const current = [{ ...passed[0], prompt: 'Which one has the capital letters and periods right?' } as Question];
    const r = classify(base, current);
    expect(r.reprompted).toEqual([{ index: 0, from: 'Pick the right sentence.', to: 'Which one has the capital letters and periods right?', hand: true, relabeled: false, question: current[0] }]);
    expect(r.renamed).toEqual([{ index: 0, names: [{ from: 'Mia', to: 'Nova' }], question: current[0] }]);
    expect(r.rewritten).toEqual([]);
  });

  it('a prompt changed only by a rename is listed under names, not prompts', () => {
    const base = [pick('Ben and Tom are brothers. Which one tells about them?', ['They are tall.', 'They is tall.'])];
    const passed = applyPass(base, SEED);
    const r = classify(base, passed);
    expect(r.renamed).toEqual([{ index: 0, names: [{ from: 'Ben', to: 'Otto' }, { from: 'Tom', to: 'Theo' }], question: passed[0] }]);
    expect(r.reprompted).toEqual([]);
  });

  it('a hand change that lands on a pool prompt (the rotation shifting) is not marked by hand', () => {
    const base = [pick('Pick the right sentence.', ['I am.', 'I is.'])];
    const passed = applyPass(base, SEED);
    const other = 'Tap the sentence with no mistakes.' === (passed[0] as { prompt: string }).prompt ? 'Which one is right?' : 'Tap the sentence with no mistakes.';
    const current = [{ ...passed[0], prompt: other } as Question];
    expect(classify(base, current).reprompted).toEqual([expect.objectContaining({ index: 0, to: other, hand: false })]);
  });

  it('an added question: positions beyond the base', () => {
    const base = [blank('I', 'happy.', ['am', 'is'])];
    const extra: Question = { type: 'odd_one_out', prompt: 'Which one does not belong?', words: ['cat', 'dog', 'run'], answer: 2 };
    const r = classify(base, [...base, extra]);
    expect(r.added).toEqual([{ index: 1, question: extra }]);
  });

  it('a rewritten question: other fields changed, with what it was after the pass; picture re-chosen → no check', () => {
    const base = [blank('Leo has a red', '.', ['hat', 'hats'], 0, 'billed-cap')];
    const passed = applyPass(base, SEED);
    const current = [blank('Milo has a red', 'on his elephant.', ['hat', 'hats'], 0, 'elephant')];
    const r = classify(base, current);
    expect(r.rewritten).toEqual([{ index: 0, was: passed[0], question: current[0], namesOnly: false, checkPicture: false }]);
    expect(r.renamed).toEqual([]);
    expect(r.reprompted).toEqual([]);
  });

  it('a rewritten question whose nouns changed but picture did not gets a picture check', () => {
    const base = [blank('The dog', 'in the yard.', ['runs', 'run'], 0, 'dog')];
    const current = [blank('The bear', 'in the bath.', ['runs', 'run'], 0, 'dog')];
    expect(classify(base, current).rewritten).toEqual([{ index: 0, was: base[0], question: current[0], namesOnly: false, checkPicture: true }]);
  });

  it('a hand rename (Mr. Park → Mr. Bell) is a rewrite of names only, with no picture check', () => {
    const base = [blank('Mr. Park', 'our teacher.', ['is', 'are'], 0, 'school')];
    const current = [blank('Mr. Bell', 'our teacher.', ['is', 'are'], 0, 'school')];
    expect(classify(base, current).rewritten).toEqual([{ index: 0, was: base[0], question: current[0], namesOnly: true, checkPicture: false }]);
  });

  it('a name swapped for Pip the dog is a silly rewrite, not a rename', () => {
    const base = [blank('Yesterday, Finn', 'to the store.', ['went', 'goes'])];
    const current = [blank('Yesterday, Pip', 'to the store.', ['went', 'goes'])];
    expect(classify(base, current).rewritten).toEqual([expect.objectContaining({ index: 0, namesOnly: false })]);
  });

  it('compares content-file questions (with their skill) regardless of key order', () => {
    const base = [{ type: 'fill_blank', skill: 'be', before: 'I', after: 'happy.', choices: ['am', 'is'], answer: 0 } as unknown as Question];
    const current = [{ type: 'fill_blank', skill: 'be', answer: 0, before: 'I', after: 'happy.', choices: ['am', 'is'] } as unknown as Question];
    expect(classifyChanges(base, current, base)).toEqual({ renamed: [], reprompted: [], added: [], rewritten: [] });
  });
});

describe('renderQuestion', () => {
  it('pick_one: prompt, choices with the right one marked, picture', () => {
    expect(renderQuestion(pick('Which one is right?', ['The dog are big.', 'The dog is big.'], 1, 'dog'))).toBe(
      ['Which one is right?', '- The dog are big.', '- ✔ The dog is big.', '- picture: dog'].join('\n'));
  });
  it('listen_tap: what it says, then the choices', () => {
    const q: Question = { type: 'listen_tap', prompt: 'Tap what you hear.', audioText: 'cat', choices: [{ text: 'cat' }, { text: 'cap' }], answer: 0 };
    expect(renderQuestion(q)).toBe(['Tap what you hear.', '- says: "cat"', '- ✔ cat', '- cap'].join('\n'));
  });
  it('fill_blank: the sentence with the right choice marked, then the others', () => {
    expect(renderQuestion(blank('I', 'happy.', ['is', 'am'], 1))).toBe(['I [✔ am] happy.', '- other choices: is'].join('\n'));
  });
  it('find_fix: the wrong word struck, the right fix marked', () => {
    const q: Question = { type: 'find_fix', words: ['Three', 'dogs', 'is', 'here.'], wrongIndex: 2, fixes: ['are', 'am'], answer: 0, picture: 'dog' };
    expect(renderQuestion(q)).toBe(['Three dogs ~~is~~ [✔ are] here.', '- other fixes: am', '- picture: dog'].join('\n'));
  });
  it('build_it: the tiles in order, then extra tiles', () => {
    const q: Question = { type: 'build_it', prompt: 'Build it!', tiles: ['I', 'am', 'here.'], distractors: ['is'] };
    expect(renderQuestion(q)).toBe(['Build it!', '- ✔ I am here.', '- extra tiles: is'].join('\n'));
  });
  it('sort_it: each group with its items', () => {
    const q: Question = { type: 'sort_it', prompt: 'Sort them out.', groups: ['One', 'More'], items: [{ text: 'cat', group: 0 }, { text: 'dogs', group: 1 }, { text: 'hen', group: 0 }] };
    expect(renderQuestion(q)).toBe(['Sort them out.', '- One: cat, hen', '- More: dogs'].join('\n'));
  });
  it('right_wrong: prompt, sentence, answer', () => {
    const q: Question = { type: 'right_wrong', prompt: 'Is this sentence right?', sentence: 'The pig is ride a bike.', right: false };
    expect(renderQuestion(q)).toBe(['Is this sentence right?', '- "The pig is ride a bike."', '- ✔ Not right'].join('\n'));
    expect(renderQuestion({ ...q, right: true } as Question)).toContain('- ✔ Right');
  });
  it('odd_one_out: the words with the odd one marked', () => {
    const q: Question = { type: 'odd_one_out', prompt: 'Which one does not belong?', words: ['walked', 'jumped', 'play'], answer: 2 };
    expect(renderQuestion(q)).toBe(['Which one does not belong?', '- walked', '- jumped', '- ✔ play'].join('\n'));
  });
  it('picture_first: the picture, then the choices', () => {
    const q: Question = { type: 'picture_first', picture: 'red-apple', prompt: 'Which one matches the picture?', choices: ['a apple', 'an apple'], answer: 1 };
    expect(renderQuestion(q)).toBe(['Which one matches the picture?', '- a apple', '- ✔ an apple', '- picture: red-apple'].join('\n'));
  });
  it('tap_all: the words with every answer marked', () => {
    const q: Question = { type: 'tap_all', prompt: 'Tap every word that needs a capital letter.', words: ['we', 'see', 'the', 'moon.'], answers: [0] };
    expect(renderQuestion(q)).toBe(['Tap every word that needs a capital letter.', '- [✔ we] see the moon.'].join('\n'));
  });
  it('match_pairs: one line per pair', () => {
    const q: Question = { type: 'match_pairs', prompt: 'Match them.', pairs: [{ left: 'I', right: 'am' }, { left: 'he', right: 'is' }] };
    expect(renderQuestion(q)).toBe(['Match them.', '- I → am', '- he → is'].join('\n'));
  });
  it('watch_answer: the video, then each question indented', () => {
    const q: Question = { type: 'watch_answer', youtubeId: 'abcdefghijk', questions: [pick('Which one is right?', ['I am.', 'I is.'])] as never };
    expect(renderQuestion(q)).toBe(['Video (YouTube abcdefghijk), then 1 question:', '- Which one is right?', '  - ✔ I am.', '  - I is.'].join('\n'));
  });
});

describe('renderFileReview', () => {
  it('writes the three sections with names, a prompt table and sequence, and new and silly questions', () => {
    const base = [pick('Pick the right sentence.', ['Mia is here.', 'Mia are here.']), blank('The dog', 'in the yard.', ['runs', 'run'], 0, 'dog')];
    const current = [...applyPass(base, SEED).slice(0, 1), blank('The bear', 'in the bath.', ['runs', 'run'], 0, 'dog'),
      { type: 'tap_all', prompt: 'Tap every naming word.', words: ['The', 'cat', 'ran.'], answers: [1] } as Question];
    const groups = [{ label: 'Week 1 · A lesson', changes: classify(base, current), questions: current }];
    const md = renderFileReview('test-week-g1.json', groups);
    const to = (current[0] as { prompt: string }).prompt;
    expect(md).toContain('## test-week-g1.json');
    expect(md).toContain('- Q1 · Mia → Nova: Nova is here.');
    expect(md).toContain(`| Pick the right sentence. | ${to} | 1 |`);
    expect(md).toContain(`- **Week 1 · A lesson:** Q1 ${to}`);
    expect(md).toContain('- **Q2 silly** (fill the blank): The bear [✔ runs] in the bath.\n  - other choices: run\n  - picture: dog\n  - picture unchanged, check it\n  - was: The dog [✔ runs] in the yard.');
    expect(md).toContain('- **Q3 new** (tap them all): Tap every naming word.\n  - The [✔ cat] ran.');
    expect(md.indexOf('### Skim: names')).toBeLessThan(md.indexOf('### Skim: prompts'));
    expect(md.indexOf('### Skim: prompts')).toBeLessThan(md.indexOf('### Read: new and silly'));
    expect(countChanges(groups)).toEqual({ renamed: 1, reprompted: 1, added: 1, rewritten: 1, pictureChecks: 1 });
  });
});
