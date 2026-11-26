# Player feel: design

*Status: draft for Kyla's approval · Nov 26, 2026 · builder check done*

## Why

The questions work, but a lesson feels the same from the first question to the last: the same two feedback cards,
the same hop and wobble, the same ding, and a done screen that only says "finished." Kyla wants lessons to feel
more alive without changing a single question. This is the first of three pieces agreed on Nov 26 (then new
question types, then a content rewrite), chosen first because every existing lesson gets better the day it ships,
ahead of the Dec 10 class test.

## Goals

- **Reactions in tiers:** the blob does more when a kid is on a roll within one lesson or practice run.
- **Rotating feedback lines:** a pool of short lines instead of one fixed "That's it!" and "Almost!", and the blob
  names the actual answer when it can ("went, not goed!").
- **One bonus question per lesson, worth +2 stars** the first time through; in free practice a bonus question is
  worth 2 instead of 1. The server chooses it and pays it; the phone only shows it.
- **Rising ding:** each right answer in a row sounds a little higher.
- **A recap on the done screens:** "You built 3 sentences. You fixed 4 mistakes." instead of only a star count.

## Non-goals

- No changes to question content, question types, or the editor (the next two pieces).
- No day streaks. Everything here resets when the lesson or practice run ends.
- No read-aloud for the new lines. Feedback is not read aloud today either; this keeps the audio bill and the
  importer untouched.
- No per-answer stars in lessons beyond the one bonus.
- Kyla choosing the bonus question (considered, see Approaches).

## Anti-goals

- **Feeling tested.** The recap never shows a score, a percentage, or a count of wrong answers. A broken roll shows
  no "streak lost" message, no sound, no sad face beyond the usual oops.
- **Noise.** One loud moment at a time. Tiers fire at 3 and 5 only, not on every answer.
- **Stars the server didn't award.** The phone never decides what the bonus is worth or whether it was earned.
- **Hokey or babyish.** Lines are short, kind, sentence case, American English, and never shout.

## Constraints

- Existing rules hold: answers are checked in the browser; attempts, completion, and stars are idempotent; stars
  are server truth; everything is authorized against the kid's assigned plans and open weeks.
- `wp_star_events` has a unique key on `(student_id, reason, ref_id)` and a check on `reason`. A new reason needs
  a migration that widens the check.
- Reduced motion: movement stops, faces and colors still change (design §5.11).
- The editor's bare preview and the teacher's "try as student" use the same player and must keep working.
- The test-star reset must also remove the new bonus stars (`supabase/reset-test-stars.sql` and the script).

## Approaches

**What the bonus is worth** (picked with Kyla, Nov 26):

1. Bonus only in free practice, worth 2.
2. **(Picked)** Bonus in lessons too, worth +2 on top of the lesson's 10 the first time through, and 2 in free
   practice. Lessons are where kids spend their time, and 12 instead of 10 barely moves the treasure chests.
3. No stars for it, only fanfare. Zero change to the star economy, but no real stake.

**Who picks the bonus question** (picked with Kyla, Nov 26):

- A. The phone picks and tells the server. Least work, but the server would pay stars on the client's word, which
  no other star in the app does.
- **B. (Picked) The server picks it when the lesson or practice set is built**, and recomputes the same pick when
  paying, so no choice is ever trusted from the phone. Fits how "Just for you" questions are already flagged.
- C. Kyla marks it in the editor. Predictable, but the same question is bonus every time and it is one more field
  on 600+ questions.

The other four items (tiers, lines, ding, recap) live entirely in the player and have one sensible shape each.

## Design

### 1. Bonus question

**In a lesson.** The server picks one of the lesson's own class questions (not "Just for you" picks, not a
watch-and-answer video) with a seeded pick over the question list in position order, seed
`${studentId}:${lessonId}:bonus`, and **stores the pick** so that pay time uses exactly the question the kid saw.
This is how "Just for you" questions actually work today: `wp_review_picks` remembers them per kid and lesson and
`forgetPicks` clears the row at completion. The bonus pick rides along as a new nullable `bonus_question_id`
column on that table (a migration), written by `getLesson` when the row is first created, or on its own if the
kid has no review picks. Recomputing instead of storing was considered and dropped: the pick is positional, so
Kyla adding, deleting, or reordering a question while a kid is mid-lesson would move the bonus to a different
question than the one that said "+2 stars." The lesson page passes it to the player as `bonus: true` on that
question, alongside the existing `forYou` flag.

Paying it happens in `completeLesson`, inside the same transaction as the lesson stars, before `forgetPicks`, and
only when the lesson completion row was just inserted (first time through):

1. Read the stored `bonus_question_id` for this kid and lesson. If there is none (an old row, or the kid never
   loaded the page), no bonus is paid.
2. Look up the run's first attempt at that question: the earliest `wp_attempts` row for this student, this
   `run_id`, and that `question_id`.
3. If it exists and `correct`, insert a star event `reason = 'lesson_bonus'`, `amount = 2`, `ref_id = lessonId`.
   The unique key makes it idempotent and ties it to the first completion, like the lesson's 10.

Because the row is cleared at completion, a redo gets a fresh pick; using a different seed suffix for a redo
(`:redo`) keeps it from landing on the same question. `starsAwarded` in the response includes the bonus. The
response also gains `bonusStars` (0 or 2) so the done screen can say so. The migration also widens the `reason`
check to include `'lesson_bonus'`.

**In free practice.** Practice sets are drawn at random on each page load and never stored, so the server cannot
recompute "the one bonus of this set." Instead a question is a bonus for a kid on a given Seoul day when
`hash(${studentId}:${seoulDate}:${questionId}) % 8 === 0`. The practice page flags matching questions
`bonus: true`; `recordAttempt` applies the same test to a first-try right answer in context `free` and writes the
existing `free_correct` event with `amount = 2` instead of 1. A set of 8 usually has one bonus, sometimes none or
two; that is accepted. Skill practice ("Practice again" from Tricky today) follows the same rule.

Both picks live in one pure module, `src/lib/bonus.ts`, with unit tests: `pickLessonBonus(questionIds, seed)` and
`isPracticeBonus(studentId, seoulDate, questionId)`. Storing the lesson pick is tested in integration: the paid
question is the stored one even after a question is added or reordered mid-run.

**Timing.** The lesson's finish must wait for outstanding attempt saves before posting lesson-complete, otherwise
the bonus attempt may not be in the database yet. `useRecordAttempt` already returns a promise per save; the lesson
screen keeps them and awaits them (with their existing retries) before calling the API. If the bonus attempt never
saved (no network through every retry), the bonus is not paid. That is the same loss a free-practice star takes
today and is accepted.

**What the kid sees** (text sketch, phone):

```
 ┌──────────────────────────────────────┐
 │ ✕   ●●●●●○○○○○○○○○○         ★ 142    │
 │                                      │
 │  [Fill the blank]  [★ Bonus!]        │  <- yellow tag (#FFE59A), star icon, same pill as "Just for you"
 │                                      │
 │   (blob, idle)  "Bonus! Which word    │  <- bubble, before answering (fill the blank and find and fix only;
 │                  fits?"              │     see below)
 │                                      │
 │   Yesterday, we ____ pizza.          │
 │   [ ate ]  [ eat ]  [ eating ]       │
 └──────────────────────────────────────┘
```

The yellow tag is what marks the bonus on every type. The bubble only adds "Bonus!" in front of its text for fill
the blank and find and fix, where the bubble is a generic line ("Bonus! Which word fits?", "Bonus! Tap the
mistake."). For pick one, build it, sort it, and listen and tap the bubble *is* the question's prompt and must
stay as it is, so the tag alone carries it there.

On a first-try right answer the feedback card shows `+2 stars` with the flying star, in free practice always and in
a lesson only when `lessonDone` is false (a redo pays nothing, so it promises nothing). The player gets a
`bonusStars` prop for this, alongside `answerStars`. The bare editor preview passes none and shows no tag.

### 2. Reactions in tiers

The player counts **first-try right answers in a row** within the run. Retries do not count; a wrong first try sets
the count back to 0 with no message or sound of its own.

| Roll | Blob | Card title | Extra |
|---|---|---|---|
| 1, 2, 4, 6+ | hop (existing) | a line from the right pool | none |
| 3 | cheer (existing, 1000ms) | a line from the "three" pool | three sparkle dots pop in around the blob, like the done screen's |
| 5 | **spin** (new, ~720ms, one full turn with a small hop) | a line from the "five" pool | sparkles again |

Nothing new fires after 5 until the count resets; a long roll stays calm. Under reduced motion the spin and
sparkles are skipped; the title line still changes. The spin is a new `Reaction` value with a keyframe in
`globals.css` next to hop and cheer.

### 3. Rotating feedback lines

A pure module `src/lib/feedbackLines.ts` holds four pools and one picker that never repeats the previous line in
the same run. Draft pools for Kyla to edit (short, sentence case, readable by a Grade 3 kid; Grades 1–2 see the
color and the blob's face first):

- **Right (12):** That's it! · Yes! · You got it. · Nice one. · Exactly. · That's right. · Perfect. · Well done. ·
  You know this. · Right on. · Yep! · Nailed it.
- **Almost (12):** Almost! · Not quite. · Close! · Try once more. · Hmm, not that one. · Look again. · So close. ·
  One more try. · Not yet. · Nearly! · Give it another go. · Take another look.
- **Three in a row (5):** Three in a row! · You're on a roll. · Look at you go! · Three for three. · Keep it up!
- **Five in a row (5):** Five in a row! · Wow. Five! · Unstoppable. · You're flying. · Five! Amazing.

The card title takes the line. The "Almost" note under it keeps today's per-type hint.

**The blob names the answer** on a right answer where the question makes it cheap, replacing its bubble's fixed
"Yes! You got it.":

- fill the blank: `"ate" fits!`
- find and fix: `went, not goed!`
- pick one, odd layouts, build it, sort it, listen and tap: the bubble keeps a line from the right pool.

The bubble's wrong-answer text rotates from the Almost pool too. None of this is read aloud (see Non-goals).

### 4. Rising ding

`playSound` takes an optional `{ rate }`. The ding plays at `1.0, 1.06, 1.12, 1.19, 1.26` for rolls 1 through 5
(semitone steps) and stays at 1.26 beyond that; a reset returns to 1.0. The audio element sets
`preservesPitch = false` so the rate changes pitch. Mute still silences it. Boop and pop are unchanged.

### 5. Recap on the done screens

The player tallies what the kid did, by question type, counting every question finished (every question ends
right, since kids retry until right), and hands the tally to `onFinish`. The done screens show up to three lines
with the largest counts, as pastel pill tags under the stars line:

| Type | Line |
|---|---|
| build it | You built 3 sentences |
| find and fix | You fixed 4 mistakes |
| sort it | You sorted 12 words (items, not questions) |
| fill the blank | You filled 5 blanks |
| pick one | You picked 2 right sentences |
| listen and tap | You matched 3 words |

Singulars where needed ("1 sentence"). No first-try count, no "out of," no percentage. Lesson done (text sketch):

```
        (blob, cheering)
        Lesson done!
        Nice work, Mina!
        ★ +10 stars
        +2 bonus stars                 <- only when paid
  [ You built 3 sentences ] [ You fixed 4 mistakes ] [ You sorted 12 words ]
        Tricky today … (existing)
        [ Next ▸ ]
```

Practice done shows the same tags under "You earned 9 stars." The lesson-done stars line shows the lesson's own
award from the server response, not the constant, so "+10" and "+2 bonus" are always what was paid.

### Data and code touched

- Migration: widen `wp_star_events.reason` check with `'lesson_bonus'`; add `wp_review_picks.bonus_question_id`
  (nullable uuid).
- `src/lib/bonus.ts` (new), `src/lib/feedbackLines.ts` (new), `src/lib/sound.ts` (rate), `src/lib/stars.ts`
  (`lessonBonus: 2`, `freeBonus: 2`).
- `src/lib/db/kid.ts` and `track.ts`: `getLesson` stores and flags the bonus, the practice set builders flag it;
  `completeLesson` pays the stored one;
  `recordAttempt` pays the practice bonus.
- `src/app/api/lesson-complete/route.ts`: `bonusStars` in the response.
- `QuestionPlayer`: `bonus` on `PlayerQuestion`, `bonusStars` prop, roll counter, rotating lines, tally in
  `onFinish`, spin reaction, sparkles.
- `Blob`: `spin` reaction; `globals.css` keyframe.
- `LessonScreen` waits for saves; `LessonDone` and `PracticeDone` show bonus and recap.
- `supabase/reset-test-stars.sql` and `scripts/reset-test-stars.ts`: include the new reason.
- Tests: unit (bonus picks, line picker, tally, ding rates), integration (bonus paid once and only with a correct
  first attempt in the run; not on redo; practice bonus amount 2), e2e (bonus tag appears once per lesson, recap
  tags on done screens, three-in-a-row reaction).

## Decided vs. left to the builder

**Decided by Kyla:** all five items; bonus worth +2 in lessons on the first run and 2 in free practice; the
server picks and pays the bonus.

**Claude's calls (Kyla can override):** tiers at 3 and 5 only; the roll counts first tries and resets silently;
the draft line pools; the blob names the answer only for fill the blank and find and fix; no read-aloud for lines;
the 1-in-8 rule for practice bonuses; the lesson pick is stored, not recomputed, so a mid-lesson edit by Kyla
can't move it; a redo gets a different bonus question and no bonus stars; the bubble says "Bonus!" only where it
isn't already the prompt; the recap counts
finished questions and shows at most three tags; semitone ding steps capped at five.

**Left to the builder:** the spin keyframe and sparkle placement; the hash function (any stable one; the seeded
shuffle in `types.ts` is fine); how the lesson screen holds and awaits pending saves; exact tag styling (reuse the
question tags); copy for the free-practice bonus bubble if "Bonus question!" needs a variant.
