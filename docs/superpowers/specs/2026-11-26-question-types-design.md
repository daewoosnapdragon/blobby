# Five new question types: design

*Status: draft for Kyla's approval · Nov 26, 2026 · builder check done*

## Why

Every lesson today is drawn from the same six ways to answer, in the same 15/15/15/10/5 mix, and kids feel it.
Kyla picked five new formats on Nov 26 to break the rhythm: **right or wrong**, **odd one out**, **tap them
all**, **match pairs**, and **picture first**. This is the second of three pieces (after player feel, before the
content rewrite). The content rewrite comes last so it can use these types.

Kyla handed the how to Claude ("you make the calls"); the one call she made herself is that match pairs uses
two visible columns, not face-down memory cards.

## Goals

- Five new self-checking question types a kid can play in lessons, free practice, skill practice, and inside
  watch and answer, with the same immediate feedback, retry, stars, bonus, roll and recap behavior the six
  existing types have.
- Kyla can add and edit each new type in the editor, with a live preview and a readable answer summary, and the
  bulk importer and content checker accept them.
- They look like the existing types: same cards, tiles, chips, tints, fonts, and motion.
- Grades 1–2 can play right or wrong and picture first without reading an instruction (the picture or the two
  buttons carry it).

## Non-goals

- New content. Writing questions in the new types is the content rewrite (next piece). This piece ships the
  types and one small e2e fixture lesson.
- Memory-card match pairs, timers, or scoring by speed.
- Pictures on individual choices (listen and tap already allows them; nothing new here).
- A "pictures required" rule for the other types. Pictures stay decorative everywhere except picture first.

## Anti-goals

- **Guessable to the point of meaningless.** Right or wrong is a coin flip by nature; that is accepted (the app
  is not an assessment), but it must never be the only type in a lesson. That is a content rule, written here
  for the content pass.
- **Punishing.** Tap them all and match pairs check the whole board at once, like sort it; a miss marks what is
  off and lets the kid fix just that, never clears everything.
- **Babyish or off-style.** No new colors, fonts, or shapes. Buttons for Grades 1–2 use words plus an icon,
  never icons alone.
- **The word "wrong" in kid-facing copy.** Buttons say Yes and No; feedback keeps the existing pools.

## Constraints

- A question is `{ type, ...payload }` validated by `src/lib/questions/schema.ts`; the DB stores `type` and
  `payload`. Answer checking is pure (`src/lib/questions/check.ts`) and runs in the browser; the server only
  records right or wrong.
- Everything that lists types must learn the new ones: schema and `Response`, `checkAnswer`, the player
  (`Body`, `TYPE_LABEL`, `TYPE_TINT`, `HINT`, `ask`), `spokenStrings`, `answerLine`, `addToTally`/`tallyLines`,
  the editor (`draft.ts`, `TypeForms.tsx`, `QuestionAnswers.tsx`, `INNER_TYPES`), and the content checker.
  The importer, `parseContent`/`parseBank`, the bonus pick, and the practice pool are type-agnostic.
- Read-aloud strings are generated per question on import or save; the new types add no special audio.
- Copy: American English, sentence case, never "wrong" in kid-facing text. Reduced motion rules unchanged.
- Phone first (390px wide). Match pairs must fit five pairs without scrolling inside the card.

## Approaches

**How to add the formats** (Claude's call):

1. **(Picked) Five distinct types**, each with its own schema, component, form, label and tint. Kids learn to
   recognize them by tag and color; Kyla sees them as separate choices in the editor; the recap can count them.
2. Options on existing types (picture first as a pick one flag, right or wrong as a two-choice pick one).
   Less code, but the editor gets confusing switches, the tag and tint can't change, and the recap can't tell
   them apart.
3. One generic configurable type. Over-engineering for five fixed formats.

**Match pairs mechanic** (Kyla's call): visible columns. Memory cards were dropped for luck, tap count, and
phone space.

**When match pairs and tap them all check** (Claude's call): a Check button once the board is complete, the
way sort it and build it work, over checking each tap as it lands. One place to get feedback, and a miss shows
what is off without resetting the rest.

## Design

### The five types

Payloads below are what the schema validates. Every one also allows the optional `picture` (decorative) that
other types have, except picture first, where it is required and is the question.

#### 1. Right or wrong (`right_wrong`)

```
{ prompt?: string, sentence: string, right: boolean, picture? }
```

- `prompt` defaults to "Is this sentence right?" when absent; the editor fills it in but Kyla can change it.
- Body: the sentence large in Andika on a card, then two wide buttons side by side: **Yes** with a check icon
  and **No** with a cross icon (the same icon set as `Marks.tsx`). Tapping answers at once.
- Response `{ yes: boolean }`; correct when `yes === q.right`.
- Read-aloud: prompt, sentence. Grades 1–2 autoplay reads the prompt; Hear it reads both.
- Recap: "You checked N sentences". Hint on a miss: "Read it once more, slowly."
- Kid-facing type tag **"Yes or no"**, tint pink. The editor and docs call the type "Right or wrong" (that is
  what Kyla named it), but the tag kids see on every question must not carry the word "wrong".

```
 ┌──────────────────────────────┐
 │ [Right or wrong]             │
 │  blob  "Is this sentence     │
 │         right?"              │
 │ ┌──────────────────────────┐ │
 │ │  She don't like carrots. │ │
 │ └──────────────────────────┘ │
 │ ┌───────────┐ ┌───────────┐  │
 │ │  ✓  Yes   │ │  ✗  No    │  │
 │ └───────────┘ └───────────┘  │
 └──────────────────────────────┘
```

#### 2. Odd one out (`odd_one_out`)

```
{ prompt: string, words: string[] (3–4), answer: idx, picture? }
```

- Body: the word grid listen and tap uses (`.wordGrid`/`.word`, big Andika words, two per row). Tapping
  answers at once.
- Response `{ choice }`; correct when `choice === answer`. No repeated words (same `noRepeats` rule).
- Read-aloud: prompt, then the words.
- Blob's answer line on a right: `“${odd}” doesn’t belong!`
- Recap: "You spotted N odd ones". Hint: "Say each word. Which one is different?"
- Label "Odd one out", tint yellow.

#### 3. Tap them all (`tap_all`)

```
{ prompt: string, words: string[] (2+), answers: idx[] (1+, all in range, no repeats), picture? }
```

- Body: the sentence as word buttons (find and fix's `.sentenceWords`/`.sentenceWord`), each a toggle
  (`aria-pressed`). A **Check** pill appears once at least one word is pressed, like build it.
- Response `{ tapped: idx[] }`; correct when the set of tapped equals the set of answers.
- On a miss: words tapped that shouldn't be are marked wrong; words that should be and aren't are left plain
  (the hint says to look again); pressed-right words keep their selected mark. Try again keeps the board.
- Read-aloud: prompt, sentence.
- Recap: "You tapped N words" (counts `answers.length`, like sort it counts items). Hint: "Look at every word.
  Did you miss one?"
- Label "Tap them all", tint blue.

#### 4. Match pairs (`match_pairs`)

```
{ prompt: string, pairs: { left: string, right: string }[] (2–5), picture? }
```

- Body: two columns of tiles (`.tile`). Left column in the given order; right column shuffled with
  `seededShuffle` (seeded by the texts, so server and client agree and it is never the original order).
  Tap a left tile (pressed), then a right tile: they pair, both tinted the same pastel (the four `GROUP_TINTS`
  sort it uses, cycling) and joined by a thin line drawn between them. Tapping a paired tile unpairs it. A
  **Check** pill appears once every left tile has a partner.
- Response `{ matches: idx[] }`: `matches[i]` is the index into `pairs` of the right-hand text chosen for left
  `i`. Correct when every `matches[i] === i`.
- On a miss: wrong pairs lose their tint and show the wrong mark; right pairs stay. Try again keeps the board.
- No repeated lefts and no repeated rights (`noRepeats`); a left may equal a right (`a` / `a`) only across
  different pairs, which the content pass avoids anyway.
- Read-aloud: prompt, then each left and right text.
- Recap: "You made N pairs" (counts `pairs.length`). Hint: "Say each pair out loud."
- Label "Match pairs", tint mint.

```
 ┌──────────────────────────────┐
 │ [Match pairs]                │
 │  blob  "Match today with     │
 │         yesterday."          │
 │  ┌──────┐          ┌───────┐ │
 │  │ walk │────────── │walked │ │  <- paired, mint
 │  └──────┘          └───────┘ │
 │  ┌──────┐          ┌───────┐ │
 │  │ go   │ (pressed) │ ate   │ │
 │  └──────┘          └───────┘ │
 │  ┌──────┐          ┌───────┐ │
 │  │ eat  │          │ went  │ │
 │  └──────┘          └───────┘ │
 │            [ Check ▸ ]  (once all paired)
 └──────────────────────────────┘
```

#### 5. Picture first (`picture_first`)

```
{ picture: string (required), prompt?: string, choices: string[] (2–4), answer: idx }
```

- `prompt` defaults to "Which one matches the picture?".
- Body: the picture large (160px) and centered at the top of the answer area, then the choices in pick one's
  `.options` layout (short choices sit two per row). The bubble does **not** also show the small decorative
  picture for this type.
- The picture's `alt` is its name with dashes as spaces ("ice cream"). This is the question, so a screen-reader
  user needs it; the catalog itself is not loaded in the player.
- If the picture file fails to load (rare: the checker guarantees the file exists, so this is a network blip),
  the body shows a small card "The picture didn't load" with a **Try again** button that reloads it. It never
  shows the picture's name as text, since for nouns that would hand over the answer. The content checker
  **fails** a picture first question whose picture is not in `public/pictures`, and the editor's picture picker
  marks the field required for this type.
- Response `{ choice }`; correct when `choice === answer`.
- Read-aloud: prompt, then the choices (nothing here gives the answer away; the picture is the question).
- Recap: "You matched N pictures". Hint: "Look at the picture again."
- Label "Picture first", tint yellow-soft.
- Content rule (for the content pass): only for things an emoji can show: nouns, a/an, one versus many,
  phonics words. Never for tense.

### Shared behavior

- All five are `NonWatchQuestion`s, so they work inside watch and answer, in free practice, in skill practice,
  as bonus questions, and in the roll and recap, with no changes to those systems.
- `Response` gains `{ yes: boolean }`, `{ tapped: number[] }`, and `{ matches: number[] }`; `{ choice }` is
  reused by odd one out and picture first.
- `answerLine` adds odd one out only. The others fall back to the pools.
- `tallyLines` tie order appends the new types after the existing six, in the order above.
- Type tints come from the existing palette (`TYPE_TINT`): pink, yellow, blue, mint, yellow-soft.

### Editor

- `TYPE_NAMES`, `emptyDraft`, `draftFromQuestion`, `draftToPayload`, `draftWords` gain the five types;
  `INNER_TYPES` (watch and answer's inner list) includes them.
- Forms (`TypeForms.tsx`), reusing `TextField`, `ListField`, and the sort it row pattern:
  - Right or wrong: Question (prefilled), Sentence, and a Yes/No radio "Is it right?".
  - Odd one out: Instruction, Words (3–4, select the odd one).
  - Tap them all: Instruction, Sentence (whole), then word chips with checkboxes "Which words?" (the find and
    fix chip pattern, multi-select).
  - Match pairs: Instruction, then rows of Left / Right inputs (2–5) with remove and add.
  - Picture first: the picture picker first and required, Question (prefilled), Choices (2–4, select the right
    one).
- `QuestionAnswers.tsx` summaries: right or wrong shows the sentence with "Right" or "Not right"; odd one out
  lists words with the odd one marked; tap them all shows the sentence with the answers marked; match pairs
  lists "left → right"; picture first shows the picture (as today, 48px) and the choices with the right one
  marked.

### Content tooling

- `scripts/check-content.ts`: for `picture_first`, verify `public/pictures/<picture>.svg` exists; report the
  file and question otherwise and exit non-zero. Also print the new types in its type counts (automatic).
- `docs/design.md` §5.6 table gains five rows.

### Tests

- Unit: schema (valid and invalid payloads per type, including picture required and the answers-in-range rule),
  `checkAnswer` per type (right, wrong, malformed), each component (tap flows, Check appears when ready, marks on
  a miss, board kept on retry, match pairs never shows the original right-column order), `spokenStrings`,
  `tallyLines` copy, `answerLine` for odd one out, draft round-trips (`draftFromQuestion` → `draftToPayload` →
  `parseQuestion`) for all five, `QuestionAnswers` summaries.
- Integration: the editor saves and reloads one of each type; the content checker rejects a picture first with
  a missing picture.
- E2E: a fixture lesson holding one of each new type; a kid plays it through with one miss on match pairs (fix
  only the wrong pair, Check again), sees the done screen; the editor creates a match pairs question and the
  preview shows it.

## Decided vs. left to the builder

**Decided by Kyla:** the five types; match pairs as visible columns.

**Claude's calls (Kyla can override):** distinct types rather than options; Check-button checking for tap them
all and match pairs; Yes/No with icons for right or wrong; default prompts; the payload shapes above; picture
required and checked for picture first, with a text fallback; recap copy; tints; the content rules noted for
the content pass (never a lesson of only right or wrong; picture first only for what an emoji can show).

**Left to the builder:** exact spacing of the two columns and the connecting line; how the right column's
shuffle seed is formed; icon choice within `Marks.tsx`/`icons.tsx`; how the editor's picture picker shows
"required"; test fixture texts.
