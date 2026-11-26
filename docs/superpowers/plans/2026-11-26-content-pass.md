# Content Pass (Light Touch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 630 reviewed test-week and review-bank questions feel varied (one cast, rotated prompts, 99 new-type questions, about 40 silly rewrites) and give Kyla a SQL-editor path plus an in-app audio button to put them live.

**Architecture:** A pure module `src/lib/contentPass.ts` holds the cast mapping, prompt rotation and the sort-it relabel; `scripts/content-pass.ts` applies it to the eight content files in place. New and silly questions are hand-authored into the files (one task per pair of grades, one for the banks). `scripts/content-review.ts` diffs the files against `main` to write Kyla's review list. `contentToSql` gains an `update` mode with a PART 1 "what differs from the last file" query, and the teacher Plans page gains a "Make missing audio" card backed by the existing `ensureAudio` pipeline.

**Tech Stack:** TypeScript, zod, Next.js app router (server actions), React 19, postgres.js, vitest (unit + integration against local Postgres), Playwright for one e2e check of the audio card's rendering (no voice calls).

**Spec:** `docs/superpowers/specs/2026-11-26-content-pass-design.md`

## Global Constraints

- Reviewed sentences stay as they are except for: cast renames, stock-prompt rotation, the sort-it `Wrong` → `Not right` relabel, and the hand-picked silly rewrites. Nothing else in an existing question changes (type, skill, answer index, option count, picture, kind of mistake per option).
- Cast (replaces): Nova (Mia), Ruby (Mina), Zara (Stella), Milo (Leo), Otto (Ben), Finn (Sam, Jun), Theo (Tom); new: Pip the dog, Blobby. Mom, Dad, Grandpa, Grandma, "the teacher" unchanged. Rename matches `\b(name)(s|'s|s')?\b` case-insensitively, copies the first letter's case, renames a lowercase match only when the capitalized name also appears in the same question, and resolves a collision (two originals → one target in one question) by taking the next unused same-pronoun name (boys: Milo, Otto, Finn, Theo; girls: Nova, Ruby, Zara).
- Prompt pools, verbatim (sentence case, no "wrong"):
  - pick_one stock {"Which sentence is right?", "Pick the right sentence.", "Pick the right sentences.", "Which one is written the right way?"} → pool: Which one is right? · Pick the sentence that sounds right. · A robot wrote these. Which one is right? · Which one would your teacher write? · Tap the sentence with no mistakes. · One of these is right. Tap it. · Which sentence is right?
  - build_it stock {"Build the sentence."} → pool: Build the sentence. · Put the words in order. · Make a sentence from the tiles. · Tap the tiles in order. · What does this say? Put it in order. · Build it!
  - sort_it stock {"Sort the words."} → pool: Sort the words. · Put each word in its box. · Where does each one go? · Sort them out. ; stock {"Sort the sentences."} → pool: Sort the sentences. · Put each sentence in its box. · Where does each one go?
  - sort_it with a group label matching /^wrong$/i: label → "Not right" (case as the other label: "Right"/"Not right", "right"/"not right"); prompt → "Which ones are right? Sort them." The `Right` / `Needs a period` one keeps its labels and gets the same prompt.
  - Rotation: within a lesson or bank skill, stock prompts of one pool cycle through the pool starting at `hash32(lessonTitle or skillKey) % pool.length`; consecutive questions of the same pool never share a prompt; running the pass twice equals running it once.
- New questions: exactly 3 appended per test-week lesson (positions 13–15, three different types, at most one `right_wrong`), exactly 1 appended per bank skill (position 11); 99 in all. Types by skill per the spec's table; picture_first only for a thing or an animal, with a picture that exists; match_pairs 3–5 pairs; tap_all 1–4 answers; odd_one_out 4 words (3 or 4 in Grades 1–2). Every new test-week question has a picture when a concrete noun allows; bank questions have none.
- Silly rewrites: 1 per test-week lesson (20) + about 1 per two bank skills (about 20); scene only; picture re-chosen to the new key noun; register per spec §4 (animals doing people things, food in odd places, sizes gone wrong; never gross, scary or mocking).
- Content checker hard rules: no lesson or bank skill where every question is `right_wrong`; no prompt or sort-it group label contains the whole word "wrong" (case-insensitive).
- SQL update mode keeps row ids (update by position), inserts missing positions, leaves teacher-deleted positions deleted, is idempotent, and PART 1 only reads.
- "Make missing audio": 20 strings per press, remaining count shown, self-continuing until zero, stoppable, an error leaves other rows untouched; uses `ensureAudio`/`defaultAudioDeps` with the same voice.
- American English, sentence case, no kid-facing "wrong". No `src/` behavior change beyond the SQL generator, the checker helpers, and the audio feature.

## Review Focus

1. A question containing both `Sam` and `Jun` (both → Finn): the collision rule must give two different boys' names and keep pronouns sensible. Test in Task 1.
2. A pick_one whose choices are full sentences containing a stock prompt string as text (e.g. a choice "Which sentence is right?"): only the `prompt` field rotates, never choices. Test in Task 1.
3. SQL PART 2 run against a lesson where Kyla deleted position 7 in the app: the file's question 7 must not be re-inserted and positions 8–15 must still update/insert correctly. Test in Task 3.
4. "Make missing audio" when the voice service fails on string 3 of 20: strings 1–2 are saved, the rest untouched, the card shows the error and the remaining count, and the next press resumes. Test in Task 4.
5. A silly rewrite that changes the key noun without a matching picture in the catalog: the review list must flag "picture unchanged, check it" so Kyla notices. Test in Task 8.

---

### Task 1: Pure content-pass rules and the script

**Files:**
- Create: `src/lib/contentPass.ts`, `scripts/content-pass.ts`
- Test: `tests/unit/contentPass.test.ts`

**Interfaces:**
- Produces:
  - `CAST: { from: string; to: string; pronoun: 'he' | 'she' }[]`, `BOYS`, `GIRLS` as in the constraints.
  - `renameText(text: string, map: Map<string, string>, hasCapital: (name: string) => boolean): string` (whole-word stem match per the rule).
  - `renameQuestion(q: NonWatchQuestion | Question): Question` — builds the per-question map (with collision resolution over all strings of the question), applies `renameText` to every string field (prompt, sentence, choices, words, fixes, tiles, distractors, items[].text, groups, before, after, audioText, pairs, inner watch_answer questions).
  - `PROMPT_POOLS: { type: 'pick_one' | 'build_it' | 'sort_it'; stock: string[]; pool: string[] }[]` verbatim from the constraints; `relabelRightWrong(q: Question): Question`; `rotatePrompts(questions: Question[], seed: string): Question[]` (uses `hash32` from `src/lib/bonus.ts`).
  - `applyPass(questions: Question[], seed: string): Question[]` = rename → relabel → rotate, idempotent.
  - `scripts/content-pass.ts <file...>`: for a plan file, applies `applyPass` per lesson with `seed = lesson.title`; for a bank file, per skill with `seed = skillKey`; preserves the `skill` field on every question; rewrites the file with 2-space JSON and a trailing newline; prints counts (renamed, rotated, relabeled).

- [ ] **Step 1: Write the failing tests**

```ts
it('renames whole-word stems, keeps case and possessives, leaves lowercase alone unless the capital is present', () => {
  expect(renameQuestion(pick("Mia's bag is red. Mia likes it."))).toMatchObject({ prompt: "Nova's bag is red. Nova likes it." });
  expect(renameQuestion(pickWithChoices(['mina is my friend.', 'Mina is my friend.']))).toMatchObject({ choices: ['ruby is my friend.', 'Ruby is my friend.'] });
  expect(renameQuestion(pickWithChoices(['Mias bag', "Mia's bag"]))).toMatchObject({ choices: ['Novas bag', "Nova's bag"] });
  expect(renameQuestion(pickWithChoices(["Toms'", "Tom's"]))).toMatchObject({ choices: ["Theos'", "Theo's"] });
  expect(renameQuestion(pick('sam went home.'))).toMatchObject({ prompt: 'sam went home.' });   // lowercase only, no capital Sam in the question: untouched
  expect(renameQuestion(pick('the same word'))).toMatchObject({ prompt: 'the same word' });   // "same" is not a name stem
});
it('collision: Sam and Jun in one question become two different boys (Review Focus 1)', () => {
  const r = renameQuestion(pick('Sam and Jun are brothers. He likes Jun.'));
  expect(r.prompt).toBe('Finn and Theo are brothers. He likes Theo.');   // Finn taken by Sam; Jun takes the next unused boy
});
it('rotates only stock prompts, never choices (Review Focus 2), never repeats consecutively, deterministic and idempotent', () => {
  const qs = [pick('Which sentence is right?'), pick('Which sentence is right?'), pick('Which sentence is about yesterday?'), pickWithChoices(['Which sentence is right?', 'x'], 'Pick the right sentence.')];
  const once = rotatePrompts(qs, 'Yesterday'); const twice = rotatePrompts(once, 'Yesterday');
  expect(once[0].prompt).not.toBe(once[1].prompt);
  expect(PICK_POOL).toContain(once[0].prompt);
  expect(once[2].prompt).toBe('Which sentence is about yesterday?');
  expect((once[3] as PickOne).choices).toEqual(['Which sentence is right?', 'x']);
  expect(twice).toEqual(once);
  expect(rotatePrompts(qs, 'Yesterday')).toEqual(once);
});
it('relabels Right/Wrong sort-its and sets their prompt', () => {
  expect(relabelRightWrong(sortIt('Right or wrong?', ['Right', 'Wrong']))).toMatchObject({ prompt: 'Which ones are right? Sort them.', groups: ['Right', 'Not right'] });
  expect(relabelRightWrong(sortIt('Is the sentence right?', ['right', 'wrong']))).toMatchObject({ groups: ['right', 'not right'] });
  expect(relabelRightWrong(sortIt('Sort the words.', ['Right', 'Needs a period']))).toMatchObject({ prompt: 'Which ones are right? Sort them.', groups: ['Right', 'Needs a period'] });
});
it('applyPass on a copy of content/test-week-g1.json keeps every type, skill, answer and picture, and is idempotent', ...);
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/unit/contentPass.test.ts` → FAIL
- [ ] **Step 3: Implement** the module and the script. Do NOT run the script on the real files in this task.
- [ ] **Step 4: Run to verify pass**; `npx tsc --noEmit`; `npm test`.
- [ ] **Step 5: Commit** — `git commit -m "feat: content pass rules (cast rename, prompt rotation, relabel) and script"`

---

### Task 2: Checker rules

**Files:**
- Modify: `src/lib/content.ts` (add `contentRuleProblems(questions, where): string[]`), `scripts/check-content.ts`
- Test: `tests/unit/checkContent.test.ts`

**Interfaces:**
- Produces: `contentRuleProblems(questions: readonly Question[], where: string): string[]` returning messages `${where}: every question is right_wrong` and `${where}, question N: "wrong" in prompt: …` / `… in a sort group: …`; `check-content.ts` calls it per lesson and per bank skill and fails (exit 1) on any message.

- [ ] **Step 1: Failing tests**: a lesson of three `right_wrong` → one message; a prompt "Right or wrong?" → message; a sort_it group `Wrong` → message; a choice text containing "wrong" → no message; clean lesson → `[]`.
- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement**; run `npx tsx scripts/check-content.ts content/*.json` → it must now FAIL on the current files (the 18 Right/Wrong sort-its), which is expected until Task 5 runs the pass; record the count in the report.
- [ ] **Step 4: Unit tests pass**; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "feat: content checker rules for yes-or-no-only lessons and the word wrong"`

---

### Task 3: SQL update mode with PART 1

**Files:**
- Modify: `src/lib/contentSql.ts`, `scripts/content-to-sql.ts`
- Test: `tests/integration/content.test.ts` (extend), `tests/unit/contentSql.test.ts` (new)

**Interfaces:**
- Produces:
  - `contentToSql(c: ContentFile, opts?: { update?: boolean; base?: ContentFile }): string` and `bankToSql(b: BankFile, opts?: { update?: boolean; base?: BankFile }): string`. Without `update`, output unchanged. With `update`: a header comment block in the `reset-test-stars.sql` style, then `-- PART 1: LOOK FIRST` (read-only: one `select` per file listing week position, lesson position, question position, `left(payload::text, 60)` for rows whose `payload` differs from the **base** file's payload at that position, or whose position the base lacks; when no `base`, PART 1 lists every existing row), then `-- PART 2: APPLY` inside `begin; … commit;`: plans/weeks/lessons upserted as today; per position `update wp_questions set type, payload, skill, updated_at = now() where … and deleted_at is null` and, if no row (deleted or not) exists at that position, `insert`; a deleted row at that position means no insert.
  - Script: `npx tsx scripts/content-to-sql.ts <out.sql> --update --base <dir-or-git-ref> <file...>`; `--base` is a directory holding the base files by the same names, or `git:<ref>` to read `git show <ref>:<file>`.

- [ ] **Step 1: Failing tests** (integration, using the test DB and `sql.unsafe(text)`): update mode against a seeded lesson changes the payload in place and keeps the id; a missing position is inserted; a soft-deleted position is not re-inserted and later positions still update (Review Focus 3); running PART 2 twice changes nothing (compare `updated_at` after the second run); PART 1 against a base equal to the DB lists nothing, and lists exactly the edited row after an in-app style payload change; bank update mode the same by `(bank_grade, skill, position)`. Unit: the generated text contains `PART 1` and `PART 2`, `begin;`/`commit;`, and no `update` statement in PART 1.
- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Tests pass**; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "feat: SQL update mode with a look-first part"`

---

### Task 4: "Make missing audio"

**Files:**
- Create: `src/lib/audioBacklog.ts`, `src/app/teacher/audioActions.ts`, `src/app/teacher/plans/MissingAudioCard.tsx`
- Modify: `src/lib/db/teacher.ts`, `src/app/teacher/plans/page.tsx`, `src/app/teacher/plans/PlansView.tsx`, `src/app/teacher/plans/plans.module.css`
- Test: `tests/unit/audioBacklog.test.ts`, `tests/integration/teacher.test.ts` (extend), `tests/unit/missingAudioCard.test.tsx`

**Interfaces:**
- Produces:
  - `missingStrings(rows: { id: string; question: Question; audio: Record<string, string> }[]): { id: string; texts: string[] }[]` (pure: per row, the `spokenStrings` not present as keys in `audio`; rows with none omitted).
  - `countMissingAudio(): Promise<number>` and `fillMissingAudio(limit: number, deps?: { audio?: () => Promise<AudioDeps> }): Promise<{ done: number; remaining: number; error?: string }>` in `src/lib/db/teacher.ts`: loads non-deleted `wp_questions` (lessons and banks) with missing strings, takes rows until `limit` strings are covered, calls `ensureAudio(q, deps, { timeoutMs: 25_000 })` per row and writes `audio`; on a thrown error stops, keeps what was saved, returns `error` text; `remaining` recounted after.
  - Server action `makeMissingAudio(): Promise<{ done: number; remaining: number; error?: string }>` (requires teacher), and `missingAudioCount()`.
  - `MissingAudioCard({ initialRemaining })`: a card titled "Read-aloud audio"; shows "N sentences have no audio yet" or "All sentences have audio"; button **Make missing audio** that calls the action in a loop (20 per call) while remaining > 0 and the user hasn't pressed **Stop**; shows progress "Made 40 so far, 212 to go" and any error line; disabled during a call. Plans page passes `initialRemaining`.

- [ ] **Step 1: Failing tests**: unit for `missingStrings`; integration for `fillMissingAudio` with a fake voice (see `fakeAudio()` in `tests/integration/editor.test.ts`): makes audio for 20 strings and reports remaining; a fake that throws on the third string saves the first two rows' audio, returns `error`, and a second call resumes (Review Focus 4); unit for the card: renders the count, pressing the button calls the mocked action repeatedly until remaining is 0, Stop halts the loop, error text shown.
- [ ] **Step 2: Run to verify failure** → FAIL
- [ ] **Step 3: Implement** (server action pattern as in `src/app/teacher/actions.ts`; `requireTeacher()` first).
- [ ] **Step 4: Tests pass**; tsc clean; `npm run test:e2e -- tests/e2e/teacher.spec.ts` still green (the teacher side still fails closed).
- [ ] **Step 5: Commit** — `git commit -m "feat: Make missing audio on the teacher Plans page"`

---

### Task 5: Run the pass on the eight files

**Files:**
- Modify: `content/test-week-g{1,2,3,4}.json`, `content/review-bank-g{1,2,3,4}.json`

- [ ] **Step 1:** `npx tsx scripts/content-pass.ts content/test-week-g1.json content/test-week-g2.json content/test-week-g3.json content/test-week-g4.json content/review-bank-g1.json content/review-bank-g2.json content/review-bank-g3.json content/review-bank-g4.json`; record the printed counts.
- [ ] **Step 2:** `npx tsx scripts/check-content.ts content/*.json` → OK for all eight (the Right/Wrong relabel satisfies Task 2's rule). `git diff --stat`.
- [ ] **Step 3:** Spot-check by script: no remaining `Mia|Mina|Stella|Leo|Ben|Sam|Jun|Tom` stems in any question text (`grep -cE "\b(Mia|Mina|Stella|Leo|Ben|Sam|Jun|Tom)(s|'s|s')?\b"` on the files → 0, allowing `Ben` inside other words to be checked by the stem rule); count of each stock prompt now 0 except where it is also a pool member.
- [ ] **Step 4:** Run the pass a second time → `git diff` shows no change (idempotent).
- [ ] **Step 5: Commit** — `git commit -m "content: one cast, rotated prompts, Not right labels across test weeks and banks"`

---

### Task 6: New and silly questions, Grades 1 and 2 test weeks

**Files:**
- Modify: `content/test-week-g1.json`, `content/test-week-g2.json`

**Interfaces:**
- Consumes: the cast, the type-by-skill table and the voice rules (spec §3–4), `suggestPictures` in `src/lib/pictures.ts` with `public/pictures/catalog.json`.
- Produces: each of the 10 lessons has exactly 15 questions; positions 13–15 are three different new types (at most one `right_wrong`), each with `skill` set to the lesson's main skill and a picture where a concrete noun allows; exactly one existing question per lesson rewritten silly (same type, skill, answer index, option count, mistake kind; picture re-chosen).

- [ ] **Step 1:** Write a throwaway helper (in the scratchpad, not committed) that prints each lesson's skills and current questions, and `suggestPictures` results for a given sentence.
- [ ] **Step 2:** Author the 30 new questions and 10 silly rewrites. Grade 1: 4–6 word sentences, odd one out with 3 or 4 words. Grade 2: up to 8 words. Use the cast; Pip and Blobby appear at least once per grade.
- [ ] **Step 3:** `npx tsx scripts/check-content.ts content/test-week-g1.json content/test-week-g2.json` → OK; `npm test` (schema tests) green.
- [ ] **Step 4:** Self-check each new question: the right answer is right, every wrong option is wrong for the lesson's reason, no "wrong" in prompts, picture file exists, no real-name leaks.
- [ ] **Step 5: Commit** — `git commit -m "content: Grades 1-2 test weeks: new-type questions and silly rewrites (review pending)"`

---

### Task 7: New and silly questions, Grades 3 and 4 test weeks

Same as Task 6 for `content/test-week-g3.json` and `content/test-week-g4.json` (30 new, 10 silly; Grade 3–4 sentences may carry a clause; odd one out with 4 words; match pairs 4–5 pairs where the skill is past tense or plurals). Commit: `content: Grades 3-4 test weeks: new-type questions and silly rewrites (review pending)`.

---

### Task 8: New and silly questions, the four review banks, and the review list

**Files:**
- Modify: `content/review-bank-g{1,2,3,4}.json`
- Create: `scripts/content-review.ts`, `content/review/2026-11-26-content-pass.md`
- Test: `tests/unit/contentReview.test.ts`, `tests/unit/contentShape.test.ts`

**Interfaces:**
- Produces:
  - Banks: every skill has exactly 11 questions; position 11 is a new type fitting the skill (types spread so each bank uses at least four of the five); about 20 silly rewrites across the 39 skills (no pictures in banks).
  - `scripts/content-review.ts <git-ref> <out.md>`: for each of the eight files, loads the base from `git show <ref>:<file>`, applies `applyPass` to the base in memory (so mechanical changes are reproduced), and compares with the working file: **Skim: names** (base text → current text where only names differ), **Skim: prompts** (table old → new with counts, then the per-lesson sequence), **Read: new and silly** (positions beyond the base length as "new"; positions whose current text differs from the passed base as "silly, was: …"), each shown like the editor's answer summary (prompt, options with the right one marked `✔`, picture name). Pure helpers in `src/lib/contentReview.ts`: `classifyChanges(baseAfterPass: Question[], current: Question[]): { renamed: …; reprompted: …; added: …; rewritten: … }` and `renderQuestion(q): string`. A rewritten question whose picture is unchanged while its nouns changed gets the line `picture unchanged, check it` (Review Focus 5).
  - `tests/unit/contentShape.test.ts` reads the eight real files and asserts: 15 questions per test-week lesson; 11 per bank skill; positions 13–15 (lessons) and 11 (banks) are new types; three different types per lesson; at most one `right_wrong` per lesson; every `picture_first` picture exists in `public/pictures`; no stock prompt string appears as a prompt except pool members; no old cast name stem remains.

- [ ] **Step 1:** Author the 39 bank questions and about 20 silly rewrites; `check-content` OK on the four banks.
- [ ] **Step 2:** Failing tests for `classifyChanges` (a renamed, a reprompted, an added, a rewritten, and a rewritten-with-unchanged-picture fixture) and `renderQuestion` (one per type); implement; pass.
- [ ] **Step 3:** `npx tsx scripts/content-review.ts main content/review/2026-11-26-content-pass.md`; open it and confirm the three sections per file and the counts (≈100 skim-names lines, prompt table, 99 new + ≈40 silly in Read).
- [ ] **Step 4:** Write `contentShape.test.ts`; run `npm test` → all green including it.
- [ ] **Step 5: Commit** — `git commit -m "content: review banks: new-type questions and silly rewrites; review list for Kyla"`

---

### Task 9: SQL files for Kyla, docs

**Files:**
- Create: `supabase/content/2026-11-26-test-week-g{1,2,3,4}.sql`, `supabase/content/2026-11-26-review-bank-g{1,2,3,4}.sql`, `supabase/content/README.md`
- Modify: `docs/deploy.md` (Loading content section), `docs/design.md` §8 (the cast, prompt pools and the "Make missing audio" step in one short paragraph)

- [ ] **Step 1:** For each file: `npx tsx scripts/content-to-sql.ts supabase/content/2026-11-26-<name>.sql --update --base git:main content/<name>.json`. Confirm each file has PART 1 and PART 2.
- [ ] **Step 2:** `supabase/content/README.md`: the order (deploy the app first; per file run PART 1, read the list, run PART 2; then Plans → Make missing audio until zero; kids wait until zero), and that `--base git:main` means "the content as it was before this pass".
- [ ] **Step 3:** Scratch check (not committed): on the local test DB, import the `main` versions of the eight files with `importContent`/`bankToSql`, run each generated PART 2 with `sql.unsafe`, then assert every `wp_questions` payload equals the working file's question at that position and row ids are unchanged; run PART 2 again and assert no `updated_at` moved.
- [ ] **Step 4:** Docs edits; `npm test && npm run test:int` green.
- [ ] **Step 5: Commit** — `git commit -m "content: SQL files for the content pass and loading notes"`
