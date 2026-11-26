# Player Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lessons and free practice feel alive without touching any question: a server-paid bonus question, blob reactions in tiers, rotating feedback lines, a rising ding, and a recap on the done screens.

**Architecture:** Four small pure modules in `src/lib` (`bonus.ts`, `roll.ts`, `feedbackLines.ts`, `tally.ts`) carry every rule and are unit-tested. The server stores the lesson's bonus pick on `wp_review_picks` and pays it in `completeLesson`; free-practice bonuses are a per-day hash recomputed in `recordAttempt`. `QuestionPlayer` consumes the modules (roll counter, lines, ding rate, tally) and the two done screens show a shared `Recap`.

**Tech Stack:** Next.js app router, React 19, TypeScript, postgres.js, zod, vitest (unit + integration against a local Postgres), Playwright e2e, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-11-26-player-feel-design.md`

## Global Constraints

- Stars are server truth: the phone never decides what a bonus is worth or whether it was earned.
- Attempts, completion and stars stay idempotent; `wp_star_events` unique key `(student_id, reason, ref_id)`.
- Lesson bonus: `reason = 'lesson_bonus'`, `amount = 2`, `ref_id = lessonId`, paid only on the first completion and only if the run's first attempt at the stored bonus question was correct.
- Free-practice bonus: a question is a bonus for a kid on a Seoul day when `hash(studentId:seoulDate:questionId) % 8 === 0`; it pays `free_correct` with `amount = 2`.
- Roll = first-try right answers in a row within one run; a wrong first try resets it to 0 silently (no message, no sound of its own). Tiers fire at 3 (cheer + sparkles) and 5 (spin + sparkles) only.
- Ding playback rates for rolls 1..5: `1.0, 1.06, 1.12, 1.19, 1.26`, capped at 1.26; roll 0 plays 1.0. Boop and pop unchanged. Mute still silences everything.
- Copy: American English, sentence case, no all-caps, never the word "wrong"; the recap never shows a score, a percentage, or a count of wrong answers.
- Reduced motion: spin and sparkles are skipped; faces, colors and lines still change.
- The new lines are not read aloud; no audio or importer changes.
- The editor's bare preview (`bare`) shows no bonus tag and reports no tally anywhere.
- New reasons must be covered by the test-star reset: it deletes by `plan_id`, so a `lesson_bonus` row with the lesson's `plan_id` is already covered (Task 3 asserts it).

## Review Focus

1. Kyla edits a lesson (adds, deletes, reorders) while a kid is mid-lesson: the paid bonus must be the question the kid saw. Test in Task 3.
2. The kid's last attempt save is still in flight when they tap Next on the last question: lesson-complete must not run before it. Test in Task 8.
3. A stored bonus question is soft-deleted before completion: pay it anyway if the run answered it right (the kid saw "+2"). Test in Task 3.
4. A question answered wrong first, then right: the right card shows no star note, the roll is 0, the ding plays at rate 1.0. Test in Task 7.
5. The Seoul day rolls over between loading a practice set and answering: the server pays 1, the card may have shown "+2". Accepted by the spec; Task 4 documents it in a test comment and asserts the server's amount wins in the counter (the counter only ever adds what the server said).

---

### Task 1: Pure rules: bonus picks, roll, lines, tally

**Files:**
- Create: `src/lib/bonus.ts`, `src/lib/roll.ts`, `src/lib/feedbackLines.ts`, `src/lib/tally.ts`
- Modify: `src/lib/stars.ts`
- Test: `tests/unit/bonus.test.ts`, `tests/unit/roll.test.ts`, `tests/unit/feedbackLines.test.ts`, `tests/unit/tally.test.ts`, `tests/unit/stars.test.ts`

**Interfaces:**
- Produces:
  - `STAR_VALUES = { lesson: 10, weekBonus: 10, freeCorrect: 1, lessonBonus: 2, freeBonus: 2 } as const`
  - `bonus.ts`: `hash32(text: string): number` (FNV-1a, like `seededShuffle`); `pickLessonBonus(questionIds: string[], seed: string): string | null` (null for an empty list, else `questionIds[hash32(seed) % length]`); `isPracticeBonus(studentId: string, seoulDate: string, questionId: string): boolean`; `lessonBonusSeed(studentId: string, lessonId: string, redo: boolean): string` returning `` `${studentId}:${lessonId}:bonus` `` plus `:redo` when `redo`.
  - `roll.ts`: `nextRoll(roll: number, firstTry: boolean, correct: boolean): number`; `reactionFor(correct: boolean, roll: number): 'hop' | 'wobble' | 'cheer' | 'spin'`; `dingRate(roll: number): number`; `sparklesAt(roll: number): boolean` (true for 3 and 5).
  - `feedbackLines.ts`: `RIGHT_LINES`, `ALMOST_LINES`, `ROLL3_LINES`, `ROLL5_LINES: readonly string[]` with the spec's draft pools verbatim; `titlePool(correct: boolean, roll: number): readonly string[]` (ROLL3 at 3, ROLL5 at 5, RIGHT otherwise when correct, ALMOST when not); `pickLine(pool: readonly string[], last: string | null, rand?: () => number): string` never returning `last` when the pool has 2+ lines; `answerLine(q: NonWatchQuestion): string | null` returning `` `“${choice}” fits!` `` for fill_blank and `` `${fix}, not ${wrong}!` `` for find_fix, null otherwise.
  - `tally.ts`: `type Tally = Partial<Record<NonWatchQuestion['type'], number>>`; `addToTally(t: Tally, q: NonWatchQuestion): Tally` (sort_it adds `q.items.length`, every other type adds 1); `tallyLines(t: Tally): string[]` (top 3 by count, ties by the table order in the spec, copy per the spec's table with singulars: "You built 1 sentence", "You fixed 1 mistake", "You sorted 1 word", "You filled 1 blank", "You picked 1 right sentence", "You matched 1 word").

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/stars.test.ts (replace the equality assertion)
expect(STAR_VALUES).toEqual({ lesson: 10, weekBonus: 10, freeCorrect: 1, lessonBonus: 2, freeBonus: 2 });

// tests/unit/bonus.test.ts
it('pickLessonBonus is stable, in the list, and null for an empty list', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const p = pickLessonBonus(ids, 's1:l1:bonus');
  expect(ids).toContain(p);
  expect(pickLessonBonus(ids, 's1:l1:bonus')).toBe(p);
  expect(pickLessonBonus([], 'x')).toBeNull();
});
it('different seeds spread over the list', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const picks = new Set(Array.from({ length: 40 }, (_, i) => pickLessonBonus(ids, `seed${i}`)));
  expect(picks.size).toBeGreaterThan(1);
});
it('lessonBonusSeed adds :redo only for a redo', () => {
  expect(lessonBonusSeed('s', 'l', false)).toBe('s:l:bonus');
  expect(lessonBonusSeed('s', 'l', true)).toBe('s:l:bonus:redo');
});
it('isPracticeBonus is stable and about one in eight', () => {
  const n = Array.from({ length: 1600 }, (_, i) => isPracticeBonus('kid', '2026-01-10', `q${i}`)).filter(Boolean).length;
  expect(n).toBeGreaterThan(120); expect(n).toBeLessThan(280);
  expect(isPracticeBonus('kid', '2026-01-10', 'q1')).toBe(isPracticeBonus('kid', '2026-01-10', 'q1'));
});

// tests/unit/roll.test.ts
it('nextRoll counts first-try rights and resets on a first-try miss; retries change nothing', () => {
  expect(nextRoll(2, true, true)).toBe(3);
  expect(nextRoll(2, true, false)).toBe(0);
  expect(nextRoll(2, false, true)).toBe(2);
  expect(nextRoll(2, false, false)).toBe(2);
});
it('reactionFor: wobble when wrong; hop, cheer at 3, spin at 5, hop after', () => {
  expect(reactionFor(false, 0)).toBe('wobble');
  expect([1, 2, 4, 6].map((r) => reactionFor(true, r))).toEqual(['hop', 'hop', 'hop', 'hop']);
  expect(reactionFor(true, 3)).toBe('cheer');
  expect(reactionFor(true, 5)).toBe('spin');
});
it('dingRate steps by semitones and caps', () => {
  expect([0, 1, 2, 3, 4, 5, 9].map(dingRate)).toEqual([1, 1, 1.06, 1.12, 1.19, 1.26, 1.26]);
});
it('sparklesAt 3 and 5 only', () => {
  expect([1, 2, 3, 4, 5, 6].map(sparklesAt)).toEqual([false, false, true, false, true, false]);
});

// tests/unit/feedbackLines.test.ts
it('pools hold the agreed lines', () => {
  expect(RIGHT_LINES).toHaveLength(12); expect(RIGHT_LINES[0]).toBe('That’s it!');
  expect(ALMOST_LINES).toHaveLength(12); expect(ALMOST_LINES[0]).toBe('Almost!');
  expect(ROLL3_LINES).toHaveLength(5); expect(ROLL5_LINES).toHaveLength(5);
  for (const l of [...RIGHT_LINES, ...ALMOST_LINES, ...ROLL3_LINES, ...ROLL5_LINES]) expect(l).not.toMatch(/wrong/i);
});
it('titlePool picks by result and roll', () => {
  expect(titlePool(true, 3)).toBe(ROLL3_LINES);
  expect(titlePool(true, 5)).toBe(ROLL5_LINES);
  expect(titlePool(true, 4)).toBe(RIGHT_LINES);
  expect(titlePool(false, 3)).toBe(ALMOST_LINES);
});
it('pickLine never repeats the last line', () => {
  const pool = ['a', 'b'];
  for (let i = 0; i < 20; i++) expect(pickLine(pool, 'a', Math.random)).toBe('b');
  expect(pickLine(['only'], 'only')).toBe('only');
});
it('answerLine names the answer for fill_blank and find_fix only', () => {
  expect(answerLine({ type: 'fill_blank', before: 'We', after: 'pizza.', choices: ['eat', 'ate'], answer: 1 })).toBe('“ate” fits!');
  expect(answerLine({ type: 'find_fix', words: ['She', 'goed', 'home.'], wrongIndex: 1, fixes: ['went', 'gone'], answer: 0 })).toBe('went, not goed!');
  expect(answerLine({ type: 'pick_one', prompt: 'p', choices: ['a', 'b'], answer: 0 })).toBeNull();
});

// tests/unit/tally.test.ts
it('counts questions, and words for sort_it', () => {
  let t: Tally = {};
  t = addToTally(t, build);                 // a build_it fixture
  t = addToTally(t, sortWith3Items);        // a sort_it fixture with 3 items
  t = addToTally(t, sortWith3Items);
  expect(t).toEqual({ build_it: 1, sort_it: 6 });
});
it('tallyLines: top three by count, singulars, spec copy', () => {
  expect(tallyLines({ build_it: 1, find_fix: 4, sort_it: 12, fill_blank: 5, pick_one: 2 }))
    .toEqual(['You sorted 12 words', 'You filled 5 blanks', 'You fixed 4 mistakes']);
  expect(tallyLines({ build_it: 1 })).toEqual(['You built 1 sentence']);
  expect(tallyLines({ listen_tap: 3, pick_one: 1 })).toEqual(['You matched 3 words', 'You picked 1 right sentence']);
  expect(tallyLines({})).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/bonus.test.ts tests/unit/roll.test.ts tests/unit/feedbackLines.test.ts tests/unit/tally.test.ts tests/unit/stars.test.ts`
Expected: FAIL (modules not found; STAR_VALUES mismatch)

- [ ] **Step 3: Implement the four modules and extend `STAR_VALUES`**

`hash32` is FNV-1a 32-bit over UTF-16 code units (copy the loop from `seededShuffle` in `src/components/questions/types.ts`; do not import from a component file). `pickLine` draws an index with `rand`, and re-draws (or steps +1 mod length) while the line equals `last`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: same command. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/bonus.ts src/lib/roll.ts src/lib/feedbackLines.ts src/lib/tally.ts src/lib/stars.ts tests/unit/bonus.test.ts tests/unit/roll.test.ts tests/unit/feedbackLines.test.ts tests/unit/tally.test.ts tests/unit/stars.test.ts
git commit -m "feat: player feel rules (bonus picks, roll tiers, feedback lines, tally)"
```

---

### Task 2: Migration and the stored lesson bonus pick

**Files:**
- Create: `supabase/migrations/0004_player_feel.sql`
- Modify: `src/lib/db/track.ts`, `src/lib/db/kid.ts` (`LessonQuestion`, `getLesson`)
- Test: `tests/integration/lesson.test.ts`

**Interfaces:**
- Consumes: `pickLessonBonus`, `lessonBonusSeed` (Task 1).
- Produces:
  - `LessonQuestion.bonus?: boolean` (in `kid.ts`, next to `forYou`).
  - `track.ts`: `bonusPick(studentId: string, lessonId: string, classQuestionIds: string[], seed: string): Promise<string | null>`: reads `wp_review_picks.bonus_question_id` for the kid and lesson; if it is set and in `classQuestionIds`, returns it; otherwise picks with `pickLessonBonus`, upserts the row (`question_ids` `'{}'` when inserting new) setting `bonus_question_id`, and returns the pick. Null when `classQuestionIds` is empty (and nothing is written).
  - `track.ts`: `storedBonus(tx: Tx, studentId: string, lessonId: string): Promise<string | null>` reads the stored id.
  - `getLesson` flags the picked class question `bonus: true` (never a `forYou` question), with seed `lessonBonusSeed(studentId, lessonId, lessonDone)`.
  - Migration (idempotent, like 0003): drop constraint `wp_star_events_reason_check` if exists and add it back with `('lesson', 'week_bonus', 'free_correct', 'lesson_bonus')`; `alter table wp_review_picks add column if not exists bonus_question_id uuid references wp_questions(id)`.

- [ ] **Step 1: Write the failing integration tests** (in `describe('getLesson')`; use the file's existing `Q.a`, `Q.b`, `L1`, `LEO`)

```ts
it('flags exactly one class question as the bonus and keeps it across reloads', async () => {
  const { getLesson } = await import('@/lib/db/kid');
  const first = await getLesson(LEO, L1, NOW);
  const bonus = first.questions.filter((q) => q.bonus);
  expect(bonus).toHaveLength(1);
  expect(bonus[0].forYou).toBeFalsy();
  const again = await getLesson(LEO, L1, NOW);
  expect(again.questions.find((q) => q.bonus)!.id).toBe(bonus[0].id);
  const [row] = await sql<{ bonus_question_id: string }[]>`select bonus_question_id from wp_review_picks where student_id = ${LEO} and lesson_id = ${L1}`;
  expect(row.bonus_question_id).toBe(bonus[0].id);
});
it('keeps the stored bonus when a question is added before it, and repicks when the stored one is deleted', async () => {
  // insert a new question at position 0 in L1, reload: same bonus id; then soft-delete the bonus question, reload: a different, existing id
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:int -- tests/integration/lesson.test.ts`
Expected: FAIL (`bonus` undefined, column missing)

- [ ] **Step 3: Write the migration, `bonusPick`, `storedBonus`, and wire `getLesson`**

In `getLesson`, call `bonusPick` after `reviewQuestions` (so one row serves both) with the class question ids in position order, then map `bonus: q.id === pick` onto the class questions before `mixIn`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:int -- tests/integration/lesson.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_player_feel.sql src/lib/db/track.ts src/lib/db/kid.ts tests/integration/lesson.test.ts
git commit -m "feat: store a bonus question pick per kid and lesson"
```

---

### Task 3: Pay the lesson bonus at completion

**Files:**
- Modify: `src/lib/db/kid.ts` (`completeLesson`, `getWeekDone`), `src/app/api/lesson-complete/route.ts`, `src/lib/lessonOutcome.ts` (type only)
- Test: `tests/integration/lesson.test.ts`

**Interfaces:**
- Consumes: `storedBonus` (Task 2), `STAR_VALUES.lessonBonus` (Task 1).
- Produces:
  - `completeLesson(...)` returns `{ starsAwarded: number; weekDone: boolean; lessonStars: number; bonusStars: number }` where `lessonStars` is 10 or 0 and `bonusStars` is 2 or 0; `starsAwarded` still sums everything paid in this call (lesson + bonus + week bonus).
  - The API response adds `lessonStars` and `bonusStars`; `CompleteResult` in `lessonOutcome.ts` gains them as optional fields (logic unchanged).
  - `getWeekDone.weekStars` also sums `reason = 'lesson_bonus'` rows whose `ref_id` is one of the week's lessons.

- [ ] **Step 1: Write the failing integration tests** (new `describe('lesson bonus')`; write attempts with `recordAttempt(studentId, { clientAttemptId, questionId, correct, context: 'lesson', runId })`)

```ts
it('pays +2 once when the run’s first attempt at the stored bonus was right', async () => {
  // getLesson(MINA, L1) -> bonusId; recordAttempt right on bonusId with RUN; completeLesson(MINA, L1, NOW, RUN)
  expect(res.lessonStars).toBe(10); expect(res.bonusStars).toBe(2); expect(res.starsAwarded).toBe(12 /* + weekBonus if due */);
  const ev = await sql`select amount, plan_id from wp_star_events where student_id = ${MINA} and reason = 'lesson_bonus' and ref_id = ${L1}`;
  expect(ev).toHaveLength(1); expect(ev[0].amount).toBe(2); expect(ev[0].plan_id).toBe(PLAN); // covered by the test-star reset, which deletes by plan_id
  const again = await completeLesson(MINA, L1, NOW, RUN);
  expect(again.bonusStars).toBe(0); expect(again.starsAwarded).toBe(0);
});
it('pays nothing when the first attempt was wrong, even if a later one was right', ...);
it('pays nothing without a runId, or when the run never answered the bonus', ...);
it('pays nothing on a redo (the lesson was already complete)', ...);
it('pays the stored question even after it was soft-deleted mid-run', ...);   // Review Focus 3
it('pays the stored question, not a positional repick, after a question was inserted before it', ...); // Review Focus 1
it('getWeekDone.weekStars includes lesson bonus stars', ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:int -- tests/integration/lesson.test.ts`
Expected: FAIL (`bonusStars` undefined)

- [ ] **Step 3: Implement**

In `completeLesson`, inside the `if (completion)` block after the lesson star: `const bonusId = await storedBonus(tx, studentId, lessonId)`; if `bonusId && runId`, select the earliest `wp_attempts` row (`order by created_at asc limit 1`) for this student, run and question; if `correct`, insert the `lesson_bonus` event (same `on conflict ... do nothing returning id` shape) and add 2 to `starsAwarded` and `bonusStars`. This runs before `forgetPicks`. Pass the new fields through the route.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:int -- tests/integration/lesson.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/kid.ts src/app/api/lesson-complete/route.ts src/lib/lessonOutcome.ts tests/integration/lesson.test.ts
git commit -m "feat: pay the lesson bonus question at completion"
```

---

### Task 4: Free-practice bonus

**Files:**
- Modify: `src/lib/db/kid.ts` (`recordAttempt`, `getPracticeSet`, `getSkillPractice`)
- Test: `tests/integration/practice.test.ts`

**Interfaces:**
- Consumes: `isPracticeBonus`, `STAR_VALUES.freeBonus` (Task 1); `seoulDate` from `src/lib/dates.ts`.
- Produces: `getPracticeSet` and `getSkillPractice` return questions with `bonus: isPracticeBonus(studentId, seoulDate(now), q.id)`; `recordAttempt` pays `free_correct` with `amount = STAR_VALUES.freeBonus` for a first-try right answer on a bonus question (same `now`), else `freeCorrect`.

- [ ] **Step 1: Write the failing integration tests**

```ts
it('flags practice bonuses by the day hash, the same way for the set and for skill practice', async () => {
  const set = await getPracticeSet(LEO, NOW, 8, () => 0.5);
  for (const q of set) expect(!!q.bonus).toBe(isPracticeBonus(LEO, seoulDate(NOW), q.id));
});
it('a first correct free answer on a bonus question earns 2, once; a non-bonus earns 1', async () => {
  // find one id in the pool with isPracticeBonus true and one false (seed enough questions in beforeAll, or loop over pool ids)
  // recordAttempt(..., context 'free', correct) -> { starsAwarded: 2 } / { starsAwarded: 1 }; a resend of the same clientAttemptId returns the same amount
});
it('the day in `now` decides: the same question on another Seoul day may pay 1', async () => {
  // Review Focus 5: pass a `now` on a date where isPracticeBonus is false for that id; expect 1
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:int -- tests/integration/practice.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement** the flagging in both set builders and the amount choice in `recordAttempt` (replace the `STAR_VALUES.freeCorrect` literal with a local `amount`).

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:int -- tests/integration/practice.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/kid.ts tests/integration/practice.test.ts
git commit -m "feat: free-practice bonus questions pay 2"
```

---

### Task 5: Sound rate and the spin reaction

**Files:**
- Modify: `src/lib/sound.ts`, `src/components/blob/Blob.tsx`, `src/components/blob/Blob.module.css`, `src/app/globals.css`
- Test: `tests/unit/sound.test.ts`, `tests/unit/blob.test.tsx`

**Interfaces:**
- Produces:
  - `playSound(name: SoundName, opts?: { rate?: number }): void`: sets `playbackRate = opts.rate ?? 1` and `preservesPitch = false` (and `webkitPreservesPitch = false` where present) on the element before `play()`.
  - `Reaction` gains `'spin'`; `Blob.module.css` adds `.spin { animation: var(--kf-spin) 720ms var(--ease-out); }` and lists `.spin` in the reduced-motion `animation: none` rule; `globals.css` adds `--kf-spin: spin;` and a `@keyframes spin` (one full turn with a small hop, ending at `rotate(360deg)`).

- [ ] **Step 1: Write the failing tests**

```ts
// sound.test.ts (extend FakeAudio with playbackRate and preservesPitch fields)
it('plays at the given rate without preserving pitch, and at 1 by default', async () => {
  const { playSound } = await load();
  playSound('ding', { rate: 1.12 });
  expect(made[0].playbackRate).toBe(1.12);
  expect(made[0].preservesPitch).toBe(false);
  playSound('ding');
  expect(made[0].playbackRate).toBe(1);
});
// blob.test.tsx
it('renders the spin reaction', () => {
  const { container } = render(<Blob color="sunny" mood="happy" size={100} reaction="spin" />);
  expect(container.firstElementChild!.getAttribute('data-reaction')).toBe('spin');
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/unit/sound.test.ts tests/unit/blob.test.tsx` → FAIL

- [ ] **Step 3: Implement** the option, the reaction value, the CSS class and keyframe.

- [ ] **Step 4: Run to verify pass** — same command → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sound.ts src/components/blob/Blob.tsx src/components/blob/Blob.module.css src/app/globals.css tests/unit/sound.test.ts tests/unit/blob.test.tsx
git commit -m "feat: sound playback rate and blob spin reaction"
```

---

### Task 6: Recap component

**Files:**
- Create: `src/components/ui/Recap.tsx`
- Modify: `src/components/ui/ui.module.css`
- Test: `tests/unit/recap.test.tsx`

**Interfaces:**
- Consumes: `Tally`, `tallyLines` (Task 1).
- Produces: `Recap({ tally }: { tally: Tally | null | undefined })` renders `null` when there are no lines, else a `<ul data-testid="recap">` of pastel pill `<li>` items (one per line; reuse the `.tag` look: `border-radius: 999px`, 700 weight, pastel backgrounds cycling yellow-soft, mint, blue), centered, wrapping, max three.

- [ ] **Step 1: Write the failing test**

```tsx
it('shows up to three recap tags and nothing for an empty tally', () => {
  render(<Recap tally={{ build_it: 3, find_fix: 4, sort_it: 12, pick_one: 1 }} />);
  const items = within(screen.getByTestId('recap')).getAllByRole('listitem').map((li) => li.textContent);
  expect(items).toEqual(['You sorted 12 words', 'You fixed 4 mistakes', 'You built 3 sentences']);
  expect(render(<Recap tally={{}} />).container).toBeEmptyDOMElement();
  expect(render(<Recap tally={null} />).container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/unit/recap.test.tsx` → FAIL
- [ ] **Step 3: Implement `Recap`** and its styles.
- [ ] **Step 4: Run to verify pass** → PASS
- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Recap.tsx src/components/ui/ui.module.css tests/unit/recap.test.tsx
git commit -m "feat: recap tags for the done screens"
```

---

### Task 7: The player: bonus tag, roll, lines, ding, sparkles, tally

**Files:**
- Modify: `src/components/questions/QuestionPlayer.tsx`, `src/components/questions/questions.module.css`
- Test: `tests/unit/questions.test.tsx`

**Interfaces:**
- Consumes: Task 1 modules; `playSound(name, { rate })` and `'spin'` (Task 5).
- Produces:
  - `PlayerQuestion.bonus?: boolean`.
  - `QuestionPlayerProps.onFinish: (tally: Tally) => void` (both callers updated in Task 8); `QuestionPlayerProps.bonusStars?: number` (default 0): the stars noted on a bonus question's right card instead of `answerStars`.
  - Rendering: a bonus step shows `<span className={`${s.tag} ${s.bonusTag}`}>` with a 12px `StarIcon` and the text `Bonus!` (background `var(--yellow-soft)`); for fill_blank and find_fix the idle bubble is `` `Bonus! ${ask(q, found)}` ``; other types keep `ask(q, found)`.
  - The feedback card carries `data-result="right" | "wrong"`; its title is the picked line; the right card's star note shows `+N star(s)` when `rightFirst && N > 0` where `N = step.bonus ? bonusStars : answerStars`, and the flying star uses the same `N`.
  - On right: bubble = `answerLine(q) ?? <a RIGHT line>`; on wrong: bubble = an ALMOST line (its own pick, may differ from the title).
  - Sound: `playSound('ding', { rate: dingRate(roll) })` after a right answer (roll already advanced), `playSound('boop')` after a wrong one.
  - Reaction: `reactionFor(correct, roll)`; when `sparklesAt(roll)` and correct, render `<span data-testid="sparkles">` holding three dots around `.qBlob` using `--kf-pop` (keyed by `reaction.n`); none under reduced motion (CSS `animation: none; display: none` in the existing reduced-motion block).
  - Tally: a ref, `addToTally` on each `next()`; `onFinish(tally)` on the last Next. `bare` shows no tag and passes `{}`.

- [ ] **Step 1: Update existing assertions, then write the failing tests**

Replace every `toContainText('That’s it!')` / `'Almost!'` in `tests/unit/questions.test.tsx` with a check on `screen.getByRole('status').querySelector('[data-result="right"]')` (resp. `"wrong"`). Then add:

```tsx
it('bonus: tag, bubble prefix on fill_blank, +2 note on a first-try right, and no tag in bare mode', ...);
it('roll: hop, hop, cheer with sparkles at 3, spin at 5; a wrong first try resets to hop and rate 1', () => {
  // five pick_one questions answered right first try: expect playSound('ding', { rate }) calls with 1, 1.06, 1.12, 1.19, 1.26
  // and the Blob's data-reaction hop, hop, cheer, hop, spin; sparkles present at 3 and 5 only
  // then a sixth answered wrong first (boop, data-reaction wobble, no sparkles, no "streak" text) and right on retry:
  // ding rate 1, no star note (Review Focus 4)
});
it('titles come from the pools and never repeat back to back', ...);   // mock Math.random or answer 4 questions and assert each title ∈ pool and ≠ previous
it('the bubble names the answer for fill_blank and find_fix', ...);     // '“ate” fits!', 'went, not goed!'
it('onFinish receives the tally', () => { /* 2 pick_one + 1 sort_it with 3 items -> { pick_one: 2, sort_it: 3 } */ });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/unit/questions.test.tsx` → FAIL
- [ ] **Step 3: Implement** in `QuestionPlayer.tsx` and the CSS (`.bonusTag`, `.sparkles` + dots, reduced-motion rule).
- [ ] **Step 4: Run to verify pass** → PASS; also `npx tsc --noEmit` → clean (the existing zero-argument `onFinish` callers are still assignable to `(tally: Tally) => void`)
- [ ] **Step 5: Commit**

```bash
git add src/components/questions/QuestionPlayer.tsx src/components/questions/questions.module.css tests/unit/questions.test.tsx
git commit -m "feat: player roll tiers, rotating lines, rising ding, bonus tag, tally"
```

---

### Task 8: Screens: wait for saves, show bonus and recap

**Files:**
- Modify: `src/app/(kid)/lesson/[id]/LessonScreen.tsx`, `src/app/(kid)/lesson/[id]/LessonDone.tsx`, `src/app/(kid)/lesson/[id]/lessonDone.module.css`, `src/app/(kid)/practice/PracticeScreen.tsx`, `src/app/(kid)/practice/PracticeDone.tsx`
- Test: `tests/unit/kidScreens.test.ts` or a new `tests/unit/doneScreens.test.tsx`

**Interfaces:**
- Consumes: `Recap` (Task 6), `Tally` (Task 1), player props (Task 7), API fields `lessonStars`, `bonusStars` (Task 3).
- Produces:
  - `LessonScreen`: keeps every `record(...)` promise in a `pending` ref; `finish(tally)` does `await Promise.allSettled(pending.current)` before posting lesson-complete; passes `bonusStars={data.lessonDone ? 0 : STAR_VALUES.lessonBonus}` to the player; stores the tally in state.
  - `DoneState` saved variant gains `lessonStars: number; bonusStars: number`; `LessonDone` props gain `tally?: Tally | null`. The stars line shows `+{lessonStars} stars` (not the constant); a `<p className={styles.bonus}>+{bonusStars} bonus stars</p>` appears only when `bonusStars > 0`; `<Recap tally={tally} />` sits after the stars lines and before `TrickyToday`.
  - `PracticeScreen`: `onFinish={(t) => { setTally(t); setPhase('done'); }}`, passes `bonusStars={STAR_VALUES.freeBonus}`; `PracticeDone` gains `tally?: Tally | null` and renders `<Recap>` under the stars line.

- [ ] **Step 1: Write the failing tests**

```tsx
it('LessonDone shows the paid lesson stars, the bonus line only when paid, and the recap', () => {
  render(<LessonDone state={{ kind: 'saved', firstTime: true, nextHref: '/', starsBefore: 0, starsAfter: 12, lessonStars: 10, bonusStars: 2 }} name="Mina" color="mint" stars={0} onRetry={() => {}} tally={{ build_it: 2 }} />);
  expect(screen.getByText('+10 stars')).toBeInTheDocument();
  expect(screen.getByText('+2 bonus stars')).toBeInTheDocument();
  expect(screen.getByText('You built 2 sentences')).toBeInTheDocument();
});
it('LessonDone hides the bonus line at 0', ...);
it('PracticeDone shows the recap under the stars line', ...);
it('LessonScreen waits for pending saves before lesson-complete', async () => {
  // Review Focus 2: mock postWithRetry; make /api/attempt resolve on a deferred promise; finish; assert /api/lesson-complete is not called until the deferred resolves
});
```

- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement**; run `npx tsc --noEmit` → clean.
- [ ] **Step 4: Run to verify pass** — `npm test` → PASS
- [ ] **Step 5: Commit**

```bash
git add "src/app/(kid)/lesson/[id]" "src/app/(kid)/practice" tests/unit
git commit -m "feat: done screens show bonus stars and a recap; lessons wait for saves"
```

---

### Task 9: End-to-end tests and docs

**Files:**
- Modify: `tests/e2e/lesson.spec.ts`, `tests/e2e/practice.spec.ts`, `tests/e2e/watch.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/e2e/tracks.spec.ts`, `tests/e2e/stamps.spec.ts`, `docs/design.md` (§5.6, §5.8, §5.9), `docs/reset-test-stars.md`

**Interfaces:**
- Consumes: `data-result` on the feedback card (Task 7); the `Bonus!` tag; `isPracticeBonus` (Task 1) importable from tests.

- [ ] **Step 1: Replace copy assertions** in every e2e spec: `toContainText('That’s it!')` → `expect(page.locator('[role="status"] [data-result="right"]')).toBeVisible()`; `'Almost!'` → `[data-result="wrong"]`.

- [ ] **Step 2: Lesson e2e**: in the main lesson test, assert `page.getByText('Bonus!')` appears on exactly one of the lesson's questions and that the done screen shows `+10 stars` plus `+2 bonus stars` when the bonus was among the questions answered right first try (the test answers all right first try, so always); assert `starPill` reaches the old total + 2; assert at least one recap tag (`[data-testid="recap"] li`) is visible. Also assert the week-done total reflects the +2.

- [ ] **Step 3: Practice e2e**: per question, read `const bonus = await page.getByText('Bonus!').isVisible()` and expect `+2 stars` or `+1 star` accordingly, and the pill to rise by 2 or 1; the summary line equals the sum. Keep the "retry earns none" step.

- [ ] **Step 4: Run the suite**

Run: `npm test && npm run test:int && npm run test:e2e`
Expected: all PASS

- [ ] **Step 5: Docs**: add to `docs/design.md` §5.6 a short "Bonus question" paragraph (server picks and pays, +2 in lessons first time, 2 in free practice), §5.8 the new star values, §5.9 tiers, rotating lines, rising ding, recap; add a line to `docs/reset-test-stars.md` that `lesson_bonus` rows are removed with the rest because they carry the plan id.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e docs/design.md docs/reset-test-stars.md
git commit -m "test: e2e for bonus questions, reactions and recap; docs"
```
