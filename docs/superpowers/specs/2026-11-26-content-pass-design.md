# Content pass (light touch): design

*Status: draft for Kyla's approval · Nov 26, 2026*

## Why

The 630 reviewed questions in the four test weeks and four review banks are correct, but they read like one
worksheet: three prompts cover 240 of them, five types in a fixed mix, a cast of names that changes from file to
file. This pass makes them feel varied before the Dec 10 class test without putting all 630 sentences back on
Kyla's desk. It is the third of the three pieces agreed on Nov 26 (player feel, new types, content), and the
first to use the five new types.

Kyla chose the **light touch** on Nov 26: keep every reviewed sentence as it is; vary the prompts and unify the
cast mechanically; add a few new-type questions per lesson and skill; turn a handful of sentences silly. She
handed the rest of the calls to Claude.

## Goals

- **One cast** across all eight files, with names that cannot be a Snapdragon student's.
- **Prompt variety:** no two consecutive questions in a lesson share a prompt; the three stock prompts stop
  dominating.
- **The new types in every lesson:** three new questions per test-week lesson and one per review-bank skill,
  using right or wrong (Yes or no), odd one out, picture first, tap them all and match pairs where they fit.
- **A sprinkle of silly:** about one sentence per lesson and one per two bank skills rewritten as an impossible
  but clear scene, with the grammar target untouched.
- **A review list Kyla can finish in an evening:** every new or reworded sentence in one file, grouped so the
  mechanical changes are a skim and the new sentences are a read. About 140 sentences to read.
- **Re-import that cannot silently lose her in-app edits.**

## Non-goals

- Rewriting the reviewed sentences (that is the "full treatment", saved for the winter weeks).
- Winter-week content. Not written yet; it gets the full treatment later.
- Phonics content for Grades 1–2 (still to come).
- The kid's own name in sentences, and lessons as mini-stories (Kyla skipped both on Nov 26).
- Changing how the importer matches questions (it stays position-based).

## Anti-goals

- **Introducing a mistake.** Kyla's rule: one obvious error and people stop trusting the material. Every new
  or changed question passes the schema, the content checker, and a grammar read; silly never means
  ungrammatical.
- **A name that is a real kid's.** The cast is invented. If any cast name turns out to be on a roster, it is
  swapped by rerunning the script, not by hand.
- **Lessons that drag.** Lessons grow from 12 to 15 class questions (18 with the three "Just for you" ones).
  No further.
- **Hokey or mean silliness.** No gross-out, nothing scary, nobody mocked. Animals doing people things, food
  in odd places, sizes gone wrong.
- **The word "wrong" in kid-facing prompts** (the player's rule, applied to content too).
- **Pictures that give the answer away** or that no longer match a reworded sentence.

## Constraints

- Content lives in `content/test-week-g{1..4}.json` (plan files: weeks → lessons → questions, each with a
  `skill`) and `content/review-bank-g{1..4}.json` (`{ grade, skills: { key: [questions] } }`). Both are
  validated by `parseContent` / `parseBank` and the schema; `scripts/check-content.ts` runs them.
- **The importer matches questions by position within a lesson** and, by default, keeps the app's payload when
  the file differs ("teacher edits win"). Any reworded prompt or renamed character is a differing payload, so
  this pass must be imported with `--overwrite`, which also discards in-app edits. Before that, Kyla must be
  able to see what she would lose.
- Audio is keyed by text and voice; only changed or new strings are synthesized on import (about 140 new
  sentences plus about 250 new prompt strings: roughly 15,000 characters, well under a dollar).
- Questions never use real students' names. Grade 1–2 kids hear prompts read aloud and mostly cannot read
  instructions, so prompts stay short and plain.
- The two content rules from the question-types design hold: never a lesson of only Yes or no; picture first
  only for what an emoji can show (a thing or an animal), never tense. Every picture first picture must exist
  in `public/pictures`.
- Pictures are decorative elsewhere and must still match the sentence's key noun after a silly rewrite.
- American English, sentence case.

## Approaches

**How the mechanical changes are made** (Claude's call):

1. **(Picked) A reproducible script**, `scripts/content-pass.ts`, that rewrites the eight files in place:
   cast mapping and prompt rotation, deterministic and idempotent. If Kyla vetoes a name, change the table and
   rerun. The new-type and silly questions are hand-authored into the files, not generated.
2. One-off edits by hand. Faster to start, but 630 questions is error-prone and a name veto means redoing it.
3. Generating everything with a model at import time. Unreviewable; against the accuracy rule.

**How new questions enter lessons** (Claude's call): interleaved at fixed slots (after class questions 3, 7 and
11) rather than appended, so a lesson never ends with three new-format questions in a row. The importer is
position-based, so this reshuffles which database row holds which question; that is harmless now (no kid has
attempted a test-week question yet; bonus picks are cleared on completion) and it is why the import uses
`--overwrite`.

**How Kyla reviews** (Claude's call): one Markdown file per pass, not eight diffs. Mechanical changes in a skim
table, new and silly sentences as full questions with their answers marked.

## Design

### 1. The cast

| Role | Name | Pronoun | Replaces |
|---|---|---|---|
| girl | **Nova** | she | Mia |
| girl | **Ruby** | she | Mina |
| girl | **Zara** | she | Stella |
| boy | **Milo** | he | Leo |
| boy | **Otto** | he | Ben |
| boy | **Finn** | he | Sam, Jun |
| boy | **Theo** | he | Tom |
| the dog | **Pip** | it / he | (new; used in new and silly sentences) |
| the mascot | **Blobby** | it | (new; used sparingly in new and silly sentences) |

Mom, Dad, Grandpa, Grandma and "the teacher" stay as they are. The mapping preserves pronouns (every replaced
name's dominant pronoun matches its replacement). The script replaces whole words only, including possessives
(`Mia's` → `Nova's`), and never touches lowercase words (`sam` is not a name). If a question would end up with
the same name twice because two originals map to one target (Sam and Jun → Finn), the second occurrence takes
the next unused name of the same pronoun. Kyla confirms none of the nine names is on a roster; if one is, she
changes the table and the script is rerun.

### 2. Prompt rotation

Only the stock prompts rotate. A prompt that says something specific ("Which sentence is about yesterday?",
"How do we spell the past? Sort the verbs.") is left alone. Stock prompts and their pools:

- **Pick one** stock: "Which sentence is right?", "Pick the right sentence.", "Pick the right sentences.",
  "Which one is written the right way?" → pool: Which one is right? · Pick the sentence that sounds right. ·
  A robot wrote these. Which one is right? · Which one would your teacher write? · Tap the sentence with no
  mistakes. · One of these is right. Tap it. · Which sentence is right?
- **Build it** stock: "Build the sentence." → pool: Build the sentence. · Put the words in order. · Make a
  sentence from the tiles. · Tap the tiles in order. · What does this say? Put it in order. · Build it!
- **Sort it** stock: "Sort the words.", "Sort the sentences." → pool: Sort the words. · Put each word in its
  box. · Where does each one go? · Sort them out. (The "sentences" variant keeps "sentences" where the items
  are sentences: Sort the sentences. · Put each sentence in its box. · Where does each one go?)
- **Right or wrong** stock (existing pick_one prompts "Right or wrong?", "Is the sentence right or wrong?")
  → "Is this sentence right?" (these questions are two-choice pick ones today; they stay pick one with the
  new prompt and choices as they are).

Assignment is deterministic: within each lesson (or bank skill), stock prompts of a type cycle through the
pool in order, starting at an offset from a hash of the lesson title, so consecutive questions never repeat
and the files are stable across reruns. Fill the blank and find and fix have no prompt and are untouched.

### 3. New-type questions

**Where:** three per test-week lesson, interleaved after class questions 3, 7 and 11 (lessons go 12 → 15);
one per review-bank skill, appended (10 → 11 per skill). That is 60 + 40 = 100 new questions, each tagged
with the lesson's or skill's `skill` key.

**Which types where.** Each lesson gets three different new types, chosen from what fits its skills:

| Skill (keys) | Fits |
|---|---|
| be, ing, was-were, there-is-are, agreement | Yes or no · odd one out · match pairs (I → am, he → is) |
| articles | Yes or no · picture first (an apple / a apple / apples) · odd one out |
| plurals, irregular-plurals | picture first (two mice / two mouses) · match pairs (mouse → mice) · tap them all ("Tap every word that means more than one") |
| past-tense, irregular-past, did-didnt | match pairs (go → went) · odd one out (walked, jumped, play, played) · Yes or no |
| third-person-s | Yes or no · odd one out · tap them all ("Tap every word that needs an s") |
| sentence-ends, capitals-names | tap them all ("Tap every word that needs a capital letter") · Yes or no |
| prepositions, place-words | picture first (the cat is on the box) only when the picture shows the place; else Yes or no · odd one out |
| comparatives | match pairs (big → bigger) · odd one out |
| fragments, compound-comma, because-when, comma-splice, apostrophes, opening-clause-comma (G3–4) | Yes or no · odd one out · tap them all ("Tap the word that needs an apostrophe") |

Rules: no lesson has more than one Yes or no among its three; picture first only for things the Noto set can
show (an animal, a food, an object; one versus two of them is shown by the sentence, not the picture), and its
picture is checked by `check-content`; match pairs use 3 to 5 pairs; tap them all has 1 to 4 answers; odd one
out has 4 words for Grades 3–4 and 3 or 4 for Grades 1–2.

**Voice.** Same level as the reviewed questions around it (Grade 1 sentences of 4 to 6 words; Grade 4 up to a
clause). Uses the cast. Picture on every test-week new question where a concrete noun allows (bank questions
have no pictures today and stay that way).

### 4. Silly sentences

About 40 in all: one per test-week lesson (20) and one per two bank skills (about 20), picked by hand from
pick one, fill the blank, build it and find and fix questions whose grammar target does not depend on the
scene. The rewrite keeps the type, the skill, the answer index, the number of options and the kind of mistake
in each wrong option; only the scene changes. Examples of the register: "The cat drove the bus to school." ·
"Grandpa put his socks in the fridge." · "Pip the dog is reading the newspaper." · "Two elephants are hiding
under the bed." The picture is re-chosen to match the new key noun (`suggestPictures` from
`src/lib/pictures.ts` proposes; the builder confirms by eye against the catalog label).

### 5. The review list for Kyla

`content/review/2026-11-26-content-pass.md` (committed), generated by the script from the before/after files
plus the authored additions, with three sections per file:

1. **Skim: names** — one line per renamed question: `Mia → Nova` and the sentence.
2. **Skim: prompts** — a table of old prompt → new prompt with counts, then the per-lesson sequence.
3. **Read: new and silly** — each new-type question and each silly rewrite as a full question in the same
   shape the editor's answer summary uses (prompt, options, right answer marked, picture name), grouped by
   lesson or skill, with "silly, was: …" for rewrites.

Kyla marks fixes in the file or in the app after import; the file is the record of what changed.

### 6. Checker and importer changes (small code)

- `scripts/check-content.ts` adds two hard rules: no lesson (or bank skill) where every question is
  `right_wrong`; no kid-facing prompt contains the word "wrong" (case-insensitive, whole word). Both fail with
  the file, lesson or skill, and the text.
- `scripts/import-content.ts --dry-run` already counts differing questions; it now also prints each one
  (week, lesson, position, and the first 60 characters of the app's text and the file's text) so Kyla can see
  exactly which in-app edits `--overwrite` would replace. No importer semantics change.

### 7. Order of work and the import

1. Script: cast mapping and prompt rotation, with unit tests on a small fixture (idempotent, collision rule,
   specific prompts untouched, possessives).
2. Author the 100 new-type questions and the 40 silly rewrites into the files (by grade, test weeks first:
   G1, G2, G3, G4, then banks). `check-content` green after each file.
3. Generate the review list; run the full checker on all eight files; run the content unit tests.
4. Kyla reads the review list (about an evening) and fixes anything in the files or notes it.
5. Import: `--dry-run` per file, read the differing list, then `--overwrite` per file. Audio generates for
   the new strings on the same run.

### Tests

- Unit tests for the script's pure parts (`src/lib/contentPass.ts`): `renameCast(text)` whole-word and
  possessive behavior, no lowercase matches, the collision rule; `rotatePrompts(questions, seedTitle)`
  determinism, no consecutive repeats, specific prompts untouched, idempotence (running twice equals once).
- Checker unit tests for the two new rules.
- Importer dry-run printing: an integration test asserting the differing lines appear for a changed payload.
- Content: `npx tsx scripts/check-content.ts` on all eight files passes; a unit test asserts every lesson has
  15 questions, every bank skill 11, each lesson has exactly three new-type questions of three different
  types, no lesson has two Yes or no, and every picture first picture exists.

## Decided vs. left to the builder

**Decided by Kyla:** the light touch; keep reviewed sentences; prompts and cast mechanical; a few new-type and
silly questions; review before Dec 10.

**Claude's calls (Kyla can override):** the nine cast names and the mapping; the prompt pools and the no-repeat
rotation; three new questions per lesson at slots 3, 7, 11 and one per bank skill; the type-by-skill table and
the one-Yes-or-no-per-lesson rule; about 40 silly rewrites and their register; a committed Markdown review
list; `--overwrite` import with a printed differing list first; the two new checker rules.

**Left to the builder:** the exact new sentences (within the voice rules); which existing questions go silly;
picture choices for new and rewritten questions; hash and cycling details in the rotation; the review list's
exact layout.
