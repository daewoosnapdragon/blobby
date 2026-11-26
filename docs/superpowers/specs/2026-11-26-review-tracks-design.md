# Review tracks and "Tricky today": design

## Why

Kyla wants every kid's practice to include what *they* need, not only what the class needs. The Picture Detective
pretest already shows each kid's errors, so each kid gets a personal review track mixed into every lesson. At the end
of each lesson the kid sees what was tricky and can practice it right away. The track keeps learning from the kid's
misses during break. It is mainly for the kid; Kyla can see and change it.

She also wants more practice overall: questions go fast, so 10 per lesson is too few.

## Goals

- **Bigger lessons:** 5 lessons a week, 15 questions each: 12 class questions + 3 "just for you" questions.
- **Personal review track:** each kid has a set of *review skills*. Every lesson mixes in 3 questions from those
  skills, written at the kid's grade level.
- **Starting skills from the pretest:** the 8 error groups flagged "Y" in the workbook (be, -ing, sentence ends,
  a / the, plurals, past tense, he / she + -s, prepositions). A kid with none gets their workbook "Next step" skill.
- **"Tricky today" card** on the lesson-done screen: the skills the kid missed most in that lesson, in kid words,
  each with a **Practice again** button that starts a short round on that skill.
- **The track learns:** a skill the kid keeps missing joins their track; a skill they keep getting right leaves it.
- **Kyla's control:** each student's page lists their review skills, where each came from, and lets her add or
  remove one.

## Non-goals

- Parent or weekly reports, and a class-wide "trickiest skill" view (ideas 3 and 4; not now).
- Editing review-bank questions in the app's editor. The bank is reviewed as a file and re-imported.
- Lessons that draw different questions on each redo (a redo replays the same 12 class questions; the 3 personal
  questions may differ).
- Phonics review tracks for Grades 1–2 (phonics content is still to come).

## Anti-goals

- Making a kid feel tested or punished. Wrong answers still never take stars away; the card never shows a score or
  a red count, only what to practice.
- Showing one kid's errors to another kid. Questions never use real students' names.
- Lessons that break or stall when a kid has no review skills or the bank has nothing for a skill.

## Constraints

- Existing rules hold: questions are checked in the browser, attempts are idempotent, completion and stars are
  idempotent, everything is server-authorized against the kid's assigned plans and open weeks.
- `wp_attempts.question_id` references `wp_questions`, so review-bank questions must live in `wp_questions`.
- Student error data stays out of the repo, like the roster. It reaches the database through a file Kyla runs
  (SQL editor), as the roster did.
- All tables stay RLS-locked with no policies; only server code reads them.

## Approaches

Picked with Kyla (Nov 26):

1. **Mixed into every lesson (picked).** Every session touches each kid's weak spots.
2. A separate "Just for you" lesson each week: easier to build but easy to skip.
3. Free practice only: smallest change, but optional and lower stars, so the kids who need it most may never see it.

For the report: **"Tricky today" card + a track that learns (picked)**, over a parent summary or a teacher view,
because the report is mainly for the kid to act on.

## Design

### Skills

A fixed list of skill keys in code (`src/lib/skills.ts`), each with a kid-facing label, for example
`past-tense` → "Past tense (went, played)", `articles` → "a / an / the". It covers the 8 pretest error groups plus
the skills the workbook "Next step" lines map to (for example because / when, apostrophes, complete sentences,
comma before and / but / so, place words, capitals for names). Content and the database refer to skills by key.

### Questions carry a skill

- `wp_questions` gets a nullable `skill` text column. Class questions are tagged too, so a miss in a class
  question counts toward that skill.
- The content JSON gains an optional `"skill"` on each question; the importer stores it and rejects unknown keys.

### The review bank

- Review-bank questions are rows in `wp_questions` with no lesson: `lesson_id` becomes nullable and a new
  `bank_grade int` is set instead (a check keeps exactly one of the two). Their `skill` is required.
- A bank question is playable by a kid whose class grade equals `bank_grade`. `recordAttempt` and the practice
  round authorize bank questions by grade instead of by assigned plan and open week.
- Content comes from a file per grade (`content/review-bank-g<N>.json`: grade, then questions grouped by skill),
  imported with the existing importer (audio generated the same way). About 10–15 questions per skill per grade,
  enough for 3 a lesson over 5 weeks without repeats piling up.

### Each kid's review skills

New table `wp_student_skills`: `student_id`, `skill`, `source` (`pretest`, `next_step`, `auto`, `teacher`),
`active` boolean, `added_at`, `changed_at`; unique (`student_id`, `skill`). Rows are never deleted; turning a skill
off sets `active = false`, so its history stays.

### Mixing into a lesson

- `getLesson` returns the lesson's class questions plus 3 review questions, placed at about positions 4, 8 and 12
  of 15. Each review question is marked as "just for you" so the screen can show a small label.
- Choosing: rotate across the kid's active skills (a different skill first in each lesson), and within a skill
  prefer questions the kid last missed, then ones never seen, then the least recently seen.
- The choice is stable for a given kid and lesson until they finish it, so reloading mid-lesson doesn't reshuffle.
- A kid with no active skills, or skills with no bank questions, simply gets the class questions.
- Completion and stars are unchanged: a lesson is finished when the kid reaches the end; review questions count
  like any other question.

### First try

`wp_attempts` gets `first_try boolean not null default true`. The screen sends `first_try = false` for a second or
later try at the same question in the same run. "Tricky" and the track's rules count first tries only, so trying
again after a wrong answer is never held against the kid.

### The "Tricky today" card

- On the lesson-done screen, after the stars. It lists up to 2 skills with 2 or more first-try misses in this
  lesson run, most-missed first, each with its kid label and a **Practice again** button. With none, it shows a
  short "Nothing tricky today!" line instead.
- **Practice again** opens a 5-question round on that skill: the kid's own missed questions of that skill first,
  then bank questions, then open class questions with that skill. It uses free-practice rules (1 star per right
  answer, context `free`) and ends on the usual practice-done screen.
- The card works from what the screen already knows (this run's answers and each question's skill), so it needs no
  extra server call to show.

### The track learns

Checked on the server when a lesson is completed and when a practice round ends:

- **Add:** a skill with 2 or more first-try misses in that lesson run, not already active, becomes active with
  source `auto`. Missing questions in free practice never adds a skill.
- **Remove:** a skill whose last 6 first-try answers (any context) were all right becomes inactive, unless Kyla
  added it herself (source `teacher`), which stays until she removes it.
- A kid keeps at most 4 active skills. When an auto-add would make 5, the oldest `auto` or `pretest` skill without
  a recent miss gives way (it is set inactive, not deleted).

### Kyla's view

- The student page gets a **Review skills** section: each active skill with where it came from (Pretest, Next step,
  Added by practice, Added by you) and a Remove button, then an **Add a skill** picker of the other skills.
- Removed and graduated skills show underneath as a short "Done" list, so she can see the track change.

### Loading the starting skills

A SQL file, made from the four pretest workbooks matched to the roster by grade and name, inserts each kid's
starting skills (`pretest`, or `next_step` for kids with no flagged errors). Kyla checks the name matches first and
runs it in the Supabase SQL editor. Kids not in the pretest (Park Aurora, Grade 3) start with none.

### Content size

5 lessons a week × 12 class questions, for the test week and Weeks 1–5, for 4 grades (about 1,400 class
questions), plus the review banks (about 14 skills × 12 questions × 4 grades, about 670). Content is drafted in
batches, test week and Week 1 first, and reviewed by Kyla before each import.

## Left to the builder

- The exact skill list and labels, within the groups named above.
- How the screen marks a "just for you" question (a small label is enough), and the card's exact look and copy,
  within the anti-goals.
- How "stable until finished" is achieved (for example seeding the choice by student, lesson and completion count).
- Indexes, and the shape of the bank file, as long as the importer validates it.
