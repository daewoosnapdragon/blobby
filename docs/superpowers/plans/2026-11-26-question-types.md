# Five New Question Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five self-checking question types (right or wrong, odd one out, picture first, tap them all, match pairs) that play everywhere the existing six do and that Kyla can author in the editor.

**Architecture:** Each type is added end to end in one task: a zod payload in `schema.ts`, a `Response` variant and rule in `check.ts`, a player component plus its label/tint/hint entries in `QuestionPlayer.tsx`, read-aloud strings in `spoken.ts`, recap copy in `tally.ts`, and the editor's draft, form and answer summary. Nothing in the database, importer, practice pool, bonus pick or roll changes: they are type-agnostic. A final task adds a fixture lesson, e2e coverage, the content checker's picture rule and docs.

**Tech Stack:** Next.js app router, React 19, TypeScript, zod, CSS Modules, vitest (unit, jsdom + testing-library; integration against local Postgres), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-26-question-types-design.md`

## Global Constraints

- Questions are `{ type, ...payload }` validated by `parseQuestion`; answer checking is pure and runs in the browser; the server only records right or wrong.
- Every place that enumerates types gets the new ones: `schema.ts` (`nonWatchSchema`, `payloadSchemas`), `check.ts`, `QuestionPlayer.tsx` (`Body`, `TYPE_LABEL`, `TYPE_TINT`, `HINT`, `ask`), `spoken.ts`, `tally.ts`, `draft.ts` (`TYPE_NAMES`, `emptyDraft`, `draftFromQuestion`, `draftToPayload`, `draftWords`), `TypeForms.tsx`, `QuestionAnswers.tsx`, `QuestionForm.tsx` (`INNER_TYPES`). TypeScript's exhaustive switches make a missed one a compile error; `npx tsc --noEmit` must be clean at the end of every task.
- Kid-facing copy: American English, sentence case, never the word "wrong". Right or wrong's kid tag is **"Yes or no"**; its editor name is "Right or wrong". Buttons say **Yes** and **No** with the check/cross from `MarkIcon`.
- Type tints: right_wrong `#FFB5C1`, odd_one_out `#FFD95A`, picture_first `#FFE59A`, tap_all `#A9D3FF`, match_pairs `#B7E1D1`.
- Default prompts (zod `.default(...)`, so a parsed question always has `prompt`): right_wrong "Is this sentence right?", picture_first "Which one matches the picture?".
- Hints on a miss: right_wrong "Read it once more, slowly." · odd_one_out "Say each word. Which one is different?" · picture_first "Look at the picture again." · tap_all "Look at every word. Did you miss one?" · match_pairs "Say each pair out loud."
- Recap copy (`tally.ts` COPY, appended after the existing six in this order): right_wrong "You checked N sentence(s)" · odd_one_out "You spotted N odd one(s)" · picture_first "You matched N picture(s)" · tap_all "You tapped N word(s)" (adds `answers.length`) · match_pairs "You made N pair(s)" (adds `pairs.length`).
- Tap them all and match pairs check the whole board with a **Check** `PillButton size="lg"` (like build it and sort it), never per tap; a miss marks only what is off and Try again keeps the board.
- No repeated texts within a list (`noRepeats`), same as existing types.
- Reduced motion: no new animation beyond the existing `.appear` pop.
- Picture first: `picture` is required; the player shows it at 160px with `alt` = name with dashes replaced by spaces; on load error it shows "The picture didn't load" with a **Try again** button and never the name as text; the content checker fails a question whose `public/pictures/<name>.svg` is missing.
- Phone first at 390px: five match pairs must fit without scrolling inside the card.

## Review Focus

1. A match pairs question where a left text equals a right text of another pair (`a` / `a`): pairing by text would mislead; pairing must be by index. Test in Task 5.
2. Tap them all when the kid taps every word: the Check must evaluate set equality, not "contains the answers". Test in Task 4.
3. A picture first question in watch and answer and in the editor's bare preview: the large picture must render in the body in both, and the small bubble picture must not duplicate it. Test in Task 3.
4. Right or wrong inside the roll: tapping Yes on a wrong-first-try then No on retry must count as one first try (the player's `firstTry` logic is shared; verify the component calls `onAnswer` once per tap and never on re-render). Test in Task 1.
5. Editor round trip for every new type: `draftFromQuestion` → `draftToPayload` → `parseQuestion` reproduces the question, including the default prompt and the required picture. Tests in Tasks 1–5.

---

### Task 1: Right or wrong

**Files:**
- Modify: `src/lib/questions/schema.ts`, `src/lib/questions/check.ts`, `src/lib/spoken.ts`, `src/lib/tally.ts`, `src/lib/questions/draft.ts`, `src/components/questions/QuestionPlayer.tsx`, `src/components/questions/questions.module.css`, `src/app/teacher/editor/TypeForms.tsx`, `src/app/teacher/editor/QuestionAnswers.tsx`, `src/app/teacher/editor/QuestionForm.tsx` (`INNER_TYPES`)
- Create: `src/components/questions/RightWrong.tsx`
- Test: `tests/unit/rightWrong.test.tsx`

**Interfaces:**
- Produces:
  - Payload `rightWrongPayload = z.object({ prompt: text.default('Is this sentence right?'), sentence: text, right: z.boolean(), picture })`; type literal `'right_wrong'`; exported `RightWrongPayload`.
  - `Response` gains `{ yes: boolean }`; `checkAnswer` returns `typeof x.yes === 'boolean' && x.yes === q.right`.
  - `RightWrong({ q, status, onAnswer }: QProps<'right_wrong'>)`: renders `<p className={s.sentenceCard}>{q.sentence}</p>` (new class: card background, radius 22px, Andika 24px, centered, padding 18px) and `<div className={s.yesNo}>` with two `<button className={s.yesNoBtn} data-mark={...}>` labeled `Yes` (with `<MarkIcon mark="right" />`) and `No` (`<MarkIcon mark="wrong" />`), min-height 64px, side by side (grid two columns, gap 10px). Tapping calls `onAnswer(checkAnswer(q, { yes: true|false }))` once; locked when `status !== 'idle'`.
  - `spokenStrings`: `[q.prompt, q.sentence]`. `ask()`: `q.prompt`. `TYPE_LABEL.right_wrong = 'Yes or no'`.
  - Draft: `{ type: 'right_wrong'; prompt: string; sentence: string; right: boolean | null }` (+ picture); `emptyDraft` → `{ prompt: 'Is this sentence right?', sentence: '', right: null }`; payload omits `right` when null (so validation says "fill this in").
  - Form `RightWrongForm`: `TextField` Question, `TextField` Sentence (placeholder "She don't like carrots."), a radio pair "Is it right?" Yes / No.
  - `QuestionAnswers` summary: `<p className={s.sentence}>{q.sentence}</p>` then `<p className={s.others}>` "Right" (wrapped in `<Right>`) or "Not right".
  - `TYPE_NAMES.right_wrong = 'Right or wrong'`.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/unit/rightWrong.test.tsx (mock @/lib/sound like questions.test.tsx)
const rw = parseQuestion('right_wrong', { sentence: 'She don’t like carrots.', right: false });
it('schema: default prompt, boolean right, rejects a missing sentence', () => {
  expect(rw).toEqual({ type: 'right_wrong', prompt: 'Is this sentence right?', sentence: 'She don’t like carrots.', right: false });
  expect(() => parseQuestion('right_wrong', { sentence: 'x', right: 'yes' })).toThrow();
  expect(() => parseQuestion('right_wrong', { right: true })).toThrow();
});
it('checkAnswer: yes matches right', () => {
  expect(checkAnswer(rw, { yes: false })).toBe(true);
  expect(checkAnswer(rw, { yes: true })).toBe(false);
  expect(checkAnswer(rw, { choice: 0 })).toBe(false);
});
it('component: Yes/No buttons answer once and lock', () => {
  const onAnswer = vi.fn();
  render(<RightWrong q={rw} status="idle" onAnswer={onAnswer} />);
  fireEvent.click(screen.getByRole('button', { name: /No/ }));
  expect(onAnswer).toHaveBeenCalledWith(true);
  expect(onAnswer).toHaveBeenCalledTimes(1);
});
it('component: marks the tapped button when locked', ...);   // status 'wrong' after tapping Yes -> data-mark="wrong" on Yes
it('player: tag reads Yes or no; prompt in the bubble; spoken strings', () => {
  render(<QuestionPlayer questions={[{ id: 'q', question: rw }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
  expect(screen.getByText('Yes or no')).toBeInTheDocument();
  expect(screen.getByText('Is this sentence right?')).toBeInTheDocument();
  expect(spokenStrings(rw)).toEqual(['Is this sentence right?', 'She don’t like carrots.']);
});
it('tally copy', () => { expect(tallyLines({ right_wrong: 1 })).toEqual(['You checked 1 sentence']); expect(tallyLines({ right_wrong: 3 })).toEqual(['You checked 3 sentences']); });
it('draft round trip and empty draft invalid', () => {
  const d = draftFromQuestion(rw);
  expect(parseQuestion('right_wrong', draftToPayload(d))).toEqual(rw);
  expect(() => parseQuestion('right_wrong', draftToPayload(emptyDraft('right_wrong')))).toThrow();
  expect(TYPE_NAMES.right_wrong).toBe('Right or wrong');
});
it('editor form renders Question, Sentence and the Yes/No radios', ...);  // render <TypeForm draft={emptyDraft('right_wrong')} onChange={vi.fn()} />
it('answer summary shows the sentence and Not right', ...);
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/unit/rightWrong.test.tsx` → FAIL (type unknown)
- [ ] **Step 3: Implement** across the files listed; add `right_wrong` to `INNER_TYPES`.
- [ ] **Step 4: Run to verify pass** — same command → PASS; `npx tsc --noEmit` clean; `npm test` green.
- [ ] **Step 5: Commit** — `git commit -m "feat: right or wrong question type"`

---

### Task 2: Odd one out

**Files:** same shared files as Task 1; Create: `src/components/questions/OddOneOut.tsx`; Modify also `src/lib/feedbackLines.ts`; Test: `tests/unit/oddOneOut.test.tsx`

**Interfaces:**
- Produces:
  - Payload `oddOneOutPayload = z.object({ prompt: text, words: z.array(text).min(3).max(4), answer: idx, picture })` with the answer-in-range refine and `noRepeats` on `words`.
  - Response reuses `{ choice }`; check `isInt(x.choice) && x.choice === q.answer`.
  - `OddOneOut`: the listen-tap grid (`s.wordGrid` with `data-count`, `s.word` buttons, `s.cornerMark` with `MarkIcon` when marked); tapping answers once.
  - `spokenStrings`: `[q.prompt, ...q.words]`. `ask()`: `q.prompt`. `TYPE_LABEL = 'Odd one out'`.
  - `answerLine` for odd_one_out: `` `“${bare(q.words[q.answer])}” doesn’t belong!` `` (reuse the existing `bare()` trim).
  - Draft `{ type: 'odd_one_out'; prompt: string; words: string[]; answer: number }`; `emptyDraft` → `{ prompt: '', words: ['', '', ''], answer: -1 }`; payload uses `compact(words, answer)`.
  - Form `OddOneOutForm`: `TextField` Instruction (placeholder "Which word doesn’t belong?"), `ListField` legend "Words", hint "Three or four words. Select the odd one.", min 3, max 4, with `answer`.
  - Summary: `<p className={s.prompt}>` then a `<ul className={s.choices}>` with the odd one wrapped in `<Right>`.
  - `TYPE_NAMES.odd_one_out = 'Odd one out'`.

- [ ] **Step 1: Write the failing tests** (same shape as Task 1): schema (min 3, max 4, repeats rejected, answer range), check, component (tap answers once; marked when locked), player tag text, spoken order, `answerLine({... words: ['walk','walked','jumped','played'], answer: 0})` → `“walk” doesn’t belong!`, tally "You spotted 2 odd ones" / "You spotted 1 odd one", draft round trip, form fields, summary.
- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify pass**; tsc clean; `npm test` green.
- [ ] **Step 5: Commit** — `git commit -m "feat: odd one out question type"`

---

### Task 3: Picture first

**Files:** shared files as Task 1; Create: `src/components/questions/PictureFirst.tsx`; Modify also `src/components/questions/QuestionPlayer.tsx` (skip the bubble picture for this type), `src/app/teacher/editor/QuestionForm.tsx` (required marker on the picker for this type), `src/app/teacher/editor/PicturePicker.tsx` (optional `required?: boolean` showing "Required for picture first" in its hint); Test: `tests/unit/pictureFirst.test.tsx`

**Interfaces:**
- Produces:
  - Payload `pictureFirstPayload = z.object({ picture: z.string().regex(PICTURE_RE, 'is not a picture name'), prompt: text.default('Which one matches the picture?'), choices: z.array(text).min(2).max(4), answer: idx })` + range refine + `noRepeats`. (Factor the existing picture regex into a `PICTURE_RE` const so both the optional and the required field share it.)
  - Response `{ choice }`; check as pick one.
  - `PictureFirst`: `<div className={s.bigPicture}>` holding `<img src={pictureSrc(q.picture)} alt={q.picture.replace(/-/g, ' ')} width={160} height={160} />`; on `onError`, replace with `<div className={s.pictureMissing}>` text "The picture didn't load" and a `<button>` "Try again" that re-sets the `src` (bump a counter in the query string). Below it, the pick one options markup (`s.options` with `data-short`, `s.option`, `s.letter`). Tapping answers once.
  - `QuestionPlayer`: `<QuestionPicture>` in the bubble is not rendered when `q.type === 'picture_first'`.
  - `spokenStrings`: `[q.prompt, ...q.choices]`. `ask()`: `q.prompt`. `TYPE_LABEL = 'Picture first'`.
  - Draft `{ type: 'picture_first'; prompt: string; choices: string[]; answer: number }` with `picture` required in meaning (still a string, `''` = missing → payload omits it → validation fails "picture: is not a picture name"); `emptyDraft` → `{ picture: '', prompt: 'Which one matches the picture?', choices: ['', ''], answer: -1 }`.
  - Form `PictureFirstForm`: `TextField` Question, `ListField` Choices (hint "Two to four. Select the one that matches the picture.", min 2, max 4). The picker stays where `QuestionForm` renders it; pass `required` when the draft type is `picture_first`.
  - Summary: picture at 48px as today, prompt, choices list with `<Right>`.
  - `TYPE_NAMES.picture_first = 'Picture first'`. `draftWords`: `[prompt, ...choices]`.

- [ ] **Step 1: Write the failing tests**: schema (picture required and validated, default prompt, 2–4 choices), check, component (renders img with `alt="ice cream"` for `picture: 'ice-cream'`; firing `error` on the img shows "The picture didn't load" and a Try again button, and never the text "ice cream" outside the alt; tap answers once), player (no `s.qPicture` img in the bubble for this type; inside a `watch_answer` wrapper the big picture still renders; with `bare` the big picture renders), spoken, tally "You matched 1 picture" / "You matched 4 pictures", draft round trip (empty draft invalid because picture missing), form and picker `required` hint, summary.
- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify pass**; tsc clean; `npm test` green.
- [ ] **Step 5: Commit** — `git commit -m "feat: picture first question type"`

---

### Task 4: Tap them all

**Files:** shared files as Task 1; Create: `src/components/questions/TapAll.tsx`; Test: `tests/unit/tapAll.test.tsx`

**Interfaces:**
- Produces:
  - Payload `tapAllPayload = z.object({ prompt: text, words: z.array(text).min(2), answers: z.array(idx).min(1), picture })` refined: every answer `< words.length`, no duplicate answers (message 'is repeated').
  - `Response` gains `{ tapped: number[] }`; check: `Array.isArray(x.tapped)` and the set of integer `tapped` equals the set of `q.answers` (same size, every answer present, nothing extra).
  - `TapAll`: `<div className={s.sentenceWords} role="group" aria-label="Sentence">` of `<button className={s.sentenceWord} aria-pressed={tapped.has(i)} data-mark={...}>` toggles; when `tapped.size > 0 && !locked` a `<PillButton size="lg">Check</PillButton>` calls `onAnswer(checkAnswer(q, { tapped: [...tapped] }))`. Marks when locked: status `right` → every tapped word `data-mark="right"`; status `wrong` → tapped words not in `answers` get `data-mark="wrong"`, tapped words in `answers` keep `data-mark="selected"`, untapped words have no mark. Board state persists across Try again (the component stays mounted; it must not reset on `status` change).
  - `spokenStrings`: `[q.prompt, q.words.join(' ')]`. `ask()`: `q.prompt`. `TYPE_LABEL = 'Tap them all'`.
  - `addToTally`: adds `q.answers.length`.
  - Draft `{ type: 'tap_all'; prompt: string; sentence: string; answers: number[] }`; `emptyDraft` → `{ prompt: '', sentence: '', answers: [] }`; payload: `words = sentence.trim().split(/\s+/).filter(Boolean)`, `answers` filtered to `< words.length` and sorted.
  - Form `TapAllForm`: `TextField` Instruction (placeholder "Tap every noun."), `TextField` Sentence (hint "Type the whole sentence."), then a `fieldset` "Which words?" of word chips with checkboxes (the find and fix chip pattern with `type="checkbox"`).
  - Summary: prompt, then the sentence with each answer word wrapped in `<Right>`.
  - `TYPE_NAMES.tap_all = 'Tap them all'`. `draftWords`: `[prompt, sentence]`.

- [ ] **Step 1: Write the failing tests**: schema (answers in range, no duplicates, min 1), check (`{tapped:[1,3]}` vs answers `[3,1]` true; `[1]` false; `[1,3,0]` false; all words tapped when answers are a subset false — Review Focus 2), component (Check appears after the first tap and disappears when all untapped; Check sends the tapped set; miss marks: extra word `wrong`, right word `selected`, untapped none; rerender with `status="idle"` after `wrong` keeps the pressed words), player tag, spoken, tally "You tapped 5 words" from one question with 5 answers, draft round trip (sentence → words, answers sorted), form checkboxes, summary.
- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify pass**; tsc clean; `npm test` green.
- [ ] **Step 5: Commit** — `git commit -m "feat: tap them all question type"`

---

### Task 5: Match pairs

**Files:** shared files as Task 1; Create: `src/components/questions/MatchPairs.tsx`; Modify `questions.module.css`; Test: `tests/unit/matchPairs.test.tsx`

**Interfaces:**
- Produces:
  - Payload `matchPairsPayload = z.object({ prompt: text, pairs: z.array(z.object({ left: text, right: text })).min(2).max(5), picture })` with `noRepeats` on lefts (noun 'left') and on rights (noun 'right').
  - `Response` gains `{ matches: number[] }`; check: `Array.isArray(x.matches) && x.matches.length === q.pairs.length && x.matches.every((m, i) => m === i)`.
  - `MatchPairs`: two columns in `<div className={s.pairCols}>` (grid, two columns, row gap 10px, column gap 28px). Left tiles in pair order; right tiles in `seededShuffle(indices, seedText)` order where `seedText = q.pairs.map((p) => `${p.left}|${p.right}`).join('\n')`. Tiles are `s.tile` buttons; a selected left is `aria-pressed`. Tap left then right → `matches[left] = rightIndex` (index into `q.pairs`, by position not text; Review Focus 1); both tiles get `data-pair={k}` and `style={{ background: GROUP_TINTS[k % 4] }}` using the same four tints sort it uses (export them from a shared place or copy the array). A thin connector: `<span className={s.pairLine} data-pair={k} />` inside the left tile's row, a 2px line across the column gap (CSS only; the row's grid puts left, line, right in one row). Tapping a paired tile unpairs it. When every left has a match and `!locked`, `<PillButton size="lg">Check</PillButton>` calls `onAnswer(checkAnswer(q, { matches }))`. Miss marks: pairs with `matches[i] !== i` lose their tint and get `data-mark="wrong"` on both tiles; right pairs keep their tint and get `data-mark="right"` only when status is `right`. Board persists across Try again.
  - `spokenStrings`: `[q.prompt, ...q.pairs.flatMap((p) => [p.left, p.right])]`. `ask()`: `q.prompt`. `TYPE_LABEL = 'Match pairs'`.
  - `addToTally`: adds `q.pairs.length`.
  - Draft `{ type: 'match_pairs'; prompt: string; pairs: { left: string; right: string }[] }`; `emptyDraft` → `{ prompt: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] }`; payload drops pairs where both sides are blank, trims the rest.
  - Form `MatchPairsForm`: `TextField` Instruction (placeholder "Match today with yesterday."), then a `fieldset` "Pairs" of rows with two inputs (aria-labels `Left N`, `Right N`), a remove button (disabled at 2), and "+ Add a pair" (disabled at 5), following the sort it items row pattern.
  - Summary: prompt, then `<ul className={s.choices}>` of `left → right` lines.
  - `TYPE_NAMES.match_pairs = 'Match pairs'`. `draftWords`: `[prompt, ...all lefts and rights]`.

- [ ] **Step 1: Write the failing tests**: schema (2–5 pairs; repeated lefts rejected; repeated rights rejected; `a`/`a` across pairs allowed), check (identity true; one swap false; short array false), component (right column is never in the original order for the fixture; tap left then right pairs them with the same `data-pair`; tapping a paired tile unpairs; Check appears only when all paired; with `a` as a left in pair 0 and `a` as a right in pair 1, pairing left 0 with the right tile whose text is `a` yields `matches[0] === 1`, not 0 — Review Focus 1; miss marks only the wrong pair; board persists after `status` returns to `idle`), player tag, spoken order, tally "You made 3 pairs", draft round trip (blank pair dropped), form rows, summary.
- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement** (CSS: `.pairCols`, `.pairLine`, tile sizes so five pairs fit at 390px: tiles `min-height: 44px`, font 20px, the connector 2px `var(--ink)` at 0.25 opacity).
- [ ] **Step 4: Run to verify pass**; tsc clean; `npm test` green.
- [ ] **Step 5: Commit** — `git commit -m "feat: match pairs question type"`

---

### Task 6: Content checker, fixture lesson, e2e, docs

**Files:**
- Modify: `scripts/check-content.ts`, `tests/e2e/fixtures/seed.ts` (export `NEW_TYPES_LESSON` fixture: a lesson id, five questions, one per new type, with a `picture_first` using `picture: 'frog'`), `docs/design.md` (§5.6 table: five rows), `tests/unit/content.test.ts` or a new `tests/unit/checkContent.test.ts`
- Create: `tests/e2e/newTypes.spec.ts`

**Interfaces:**
- Consumes: the five types and their `data-*` hooks from Tasks 1–5.
- Produces: `scripts/check-content.ts` fails (non-zero exit, message naming the file, lesson title and picture) for any `picture_first` question whose `public/pictures/<picture>.svg` does not exist; factor the check into a pure `missingPictures(questions, exists: (name) => boolean): string[]` in `src/lib/content.ts` so it is unit-testable.

- [ ] **Step 1: Unit test for the checker rule**

```ts
it('names picture_first questions whose picture file is missing', () => {
  const qs = [{ type: 'picture_first', picture: 'frog', prompt: 'p', choices: ['a frog', 'frogs'], answer: 0 }, { type: 'picture_first', picture: 'nope', ... }, { type: 'pick_one', picture: 'nope', ... }];
  expect(missingPictures(qs, (n) => n === 'frog')).toEqual(['nope']);   // pick_one's decorative picture is not reported
});
```

- [ ] **Step 2: Run to verify failure** → FAIL; implement `missingPictures` and wire it into `scripts/check-content.ts` (both the plan and the bank shapes); run `npx tsx scripts/check-content.ts content/test-week-g1.json` → still OK.

- [ ] **Step 3: E2E** (`tests/e2e/newTypes.spec.ts`): in `beforeAll`, insert `NEW_TYPES_LESSON` into the open week at position 3 for the e2e plan and reset Mina (blob color null) ; in `afterAll`, delete everything the test created so later specs see the seed as before: the lesson's attempts, completions, star events (`ref_id` = lesson id), review picks, the lesson and its questions, Mina's practice days and track runs created during the test, and set Mina's `blob_color` back to null. The test: Mina picks a blob, opens the lesson, and plays all five: right or wrong (tap No on a wrong sentence → `[data-result="right"]`), odd one out (tap the odd word), picture first (the 160px img with alt `frog` is visible; tap the right choice), tap them all (tap two nouns, Check, right), match pairs (pair one wrong on purpose, Check → `[data-result="wrong"]`, Try again, fix only that pair, Check → right); the done screen shows `+10 stars` and a recap tag among "You checked 1 sentence", "You made 3 pairs" etc. Second test: as the teacher (reuse `teacher.spec.ts`'s login helper), open the editor for that lesson, add a match pairs question with two pairs, save, and see "Match pairs" in the question list.

- [ ] **Step 4: Run the suites** — `npm test && npm run test:int && npm run test:e2e` → all PASS (e2e: the new spec plus every existing spec still green, which proves the cleanup).

- [ ] **Step 5: Docs** — `docs/design.md` §5.6 table gains: Yes or no (right or wrong) · Odd one out · Picture first · Tap them all · Match pairs, one line each on what the kid does; note the two content rules under §8 (never a lesson of only right or wrong; picture first only for what an emoji can show, never tense).

- [ ] **Step 6: Commit** — `git commit -m "feat: content checker picture rule, e2e for the five new types, docs"`
