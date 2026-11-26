# Review Tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lesson mixes in 3 "just for you" questions from the kid's own review skills; the lesson-done screen shows "Tricky today" with Practice again; the track learns (auto-add, mastery with spaced repetition); Kyla sees and edits each kid's skills.

**Architecture:** Skills are fixed keys (`src/lib/skills.ts`). Questions get a `skill` column; review-bank questions are `wp_questions` rows with `bank_grade` instead of a lesson. Each kid's skills live in `wp_student_skills`. Choosing and learning rules are pure functions (`src/lib/track.ts`) called from the data layer.

**Tech Stack:** Next.js 15, postgres.js, zod, Vitest (unit + integration on local Postgres), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-review-tracks-design.md` (state model and spaced repetition supersede its older "active=false" / "leaves the track" lines).

## Global Constraints
- Lessons: the class questions, then 3 review questions placed after class questions 4, 8 and 12 (fewer if the kid has fewer available).
- Skill states: `active`, `mastered`, `removed`. Sources: `pretest`, `next_step`, `auto`, `teacher`.
- Mastered after the last 6 saved answers on that skill are right. Mastered spacing: appears every 3rd lesson, then 6th, then 12th (doubling each time it is answered right again); any miss → `active`, spacing reset to 3.
- Auto-add: ≥ 2 missed saved answers on one skill in one lesson run (not free practice). Never re-adds a skill Kyla removed (`removed` + `source = teacher` marker: `removed_by_teacher = true`).
- Cap: at most 4 `active` skills for automatic adds; if full, the oldest `auto`/`pretest` active skill with no miss in its last 6 answers becomes `mastered` (spacing 3); if none, skip the add. Teacher adds are not capped.
- "Tricky today": up to 2 skills with ≥ 2 misses this run; no scores or red counts shown to kids.
- Practice again: 5 questions on one skill; the kid's missed ones of that skill first, then bank, then open class questions of that skill; free-practice stars.
- Every saved attempt is a first try (the screens already send only first tries). `wp_attempts.run_id` groups a lesson run.
- Student error data never enters the repo.

## Review Focus
1. A kid with no skills, or skills with no bank questions → a normal 12-question lesson, no crash (Task 4 test).
2. Reload mid-lesson → the same 3 review questions (stable choice; Task 3 + Task 4 tests).
3. A grade 3 kid posting an attempt on a grade 4 bank question → 404, nothing saved (Task 4 test).
4. Kyla removes a skill, the kid misses it again twice → stays removed (Task 3 test).
5. A lesson redo → review questions may differ but completion/stars stay idempotent (Task 4 test).

---

### Task 1: Skills and schema
**Files:** Create `src/lib/skills.ts`, `supabase/migrations/0003_review_tracks.sql`; Modify `src/lib/types.ts`; Test `tests/unit/skills.test.ts`, `tests/integration/schema.test.ts`.
**Produces:** `SKILLS: Record<SkillKey, { label: string; kid: string }>` (label for Kyla, kid-facing words), `type SkillKey`, `isSkillKey(x): x is SkillKey`. Migration: `wp_questions.skill text null`; `wp_questions.lesson_id` nullable + `bank_grade int null` + check exactly one; `wp_attempts.run_id uuid null`; table `wp_student_skills (student_id uuid references wp_students, skill text, source text check, state text check, spacing int not null default 3, lessons_since int not null default 0, removed_by_teacher boolean not null default false, added_at, changed_at, primary key (student_id, skill))`, RLS on, privileges revoked.
- [ ] Tests: every key has both labels; the 8 pretest groups exist (`be`, `ing`, `sentence-ends`, `articles`, `plurals`, `past-tense`, `third-person-s`, `prepositions`); schema: bank row needs no lesson, a row with both or neither is rejected, wp_student_skills has RLS and no anon access.
- [ ] Implement; integration + unit green. Commit `feat: review track schema and skills`.

### Task 2: Content carries skills; review bank files
**Files:** Modify `src/lib/content.ts`, `scripts/content-to-sql.ts`, `scripts/import-content.ts`; Create `src/lib/bank.ts`, `scripts/bank-to-sql.ts`; Test `tests/unit/content.test.ts`, `tests/integration/content.test.ts`.
**Produces:** `ContentFile` questions gain `skill?: SkillKey` (unknown key → error naming the question); `parseBank(raw): { grade: number; questions: { skill: SkillKey; question: NonWatchQuestion }[] }`; importer stores `skill`; `bankToSql(bank)` inserts bank rows (`bank_grade`, `skill`, `position` = order within skill) only where missing.
- [ ] Tests: skill kept; bad skill rejected; re-import fills `skill` on existing questions without touching payload edits; bank parse rejects missing/unknown skill and watch questions; bank SQL idempotent (local DB).
- [ ] Implement; also emit an update SQL that sets `skill` on the live test-week questions from the files. Commit `feat: skills on questions and review bank import`.

### Task 3: Track rules (pure)
**Files:** Create `src/lib/track.ts`; Test `tests/unit/track.test.ts`.
**Produces:**
- `type TrackSkill = { skill: SkillKey; source; state; spacing: number; lessonsSince: number; removedByTeacher: boolean; addedAt: string }`
- `dueSkills(skills: TrackSkill[]): SkillKey[]` — active skills, plus mastered ones whose `lessonsSince + 1 >= spacing`.
- `chooseReview(due: SkillKey[], bank: Map<SkillKey, { id: string; lastAnswer: 'missed' | 'right' | null; lastSeen: string | null }[]>, seed: string, n = 3): string[]` — rotate skills starting at a seed-chosen offset; within a skill missed → unseen → least recently seen; deterministic for a seed.
- `afterLesson(skills: TrackSkill[], run: { skill: SkillKey; right: boolean }[], recent: Map<SkillKey, boolean[]> /* last answers, newest last, including this run */, shown: SkillKey[], now: string): TrackSkill[]` — applies auto-add, cap, mastery, miss→active, spacing growth, `lessonsSince` counters.
- [ ] Tests for each rule in Global Constraints (auto-add at 2 misses not 1; never re-add teacher-removed; cap swap; cap skip; mastery at 6 right; spacing 3→6→12; miss resets; teacher-added never mastered away; due logic; chooseReview stability and preference order; empty inputs).
- [ ] Implement. Commit `feat: review track rules`.

### Task 4: Data layer
**Files:** Modify `src/lib/db/kid.ts`, `src/lib/db/teacher.ts`; Test `tests/integration/track.test.ts`.
**Produces:** `LessonData.questions[]` gain `skill: string | null` and `forYou: boolean`; `getLesson(studentId, lessonId, now, runSeed?)`; `recordAttempt` input gains `runId?: string` and authorizes bank questions by grade; `completeLesson(studentId, lessonId, now, runId?)` runs `afterLesson` for that run; `getSkillPractice(studentId, skill, now): LessonQuestion[]` (5); `studentSkills(studentId)`, `setStudentSkill(studentId, skill, 'add' | 'remove')` for Kyla.
- [ ] Tests: Review Focus 1–5; review questions appear at the right places and carry `forYou`; a completed run with 2 misses adds the skill; mastery after 6 right; Practice again ordering; teacher add/remove.
- [ ] Implement (seed = `${studentId}:${lessonId}:${completionCount}`). Commit `feat: review tracks in lessons`.

### Task 5: Kid screens
**Files:** Modify `QuestionPlayer.tsx` (label), `LessonScreen.tsx`, `LessonDone.tsx`, attempt/complete API routes, `src/app/(kid)/practice/*` (`?skill=`); Test `tests/unit/trickyToday.test.tsx`, e2e `tests/e2e/lesson.spec.ts`.
- [ ] Tests: "Just for you" label on review questions only; Tricky today lists up to 2 skills with ≥ 2 misses in kid words, else "Nothing tricky today!"; Practice again links to `/practice?skill=<key>`; run id sent with attempts and completion.
- [ ] Implement. Commit `feat: just for you questions and Tricky today`.

### Task 6: Kyla's student page
**Files:** Modify `src/app/teacher/student/[id]/page.tsx`, `views.tsx`, `actions.ts`; Test `tests/unit/reviewSkills.test.tsx`.
- [ ] Tests: lists skills with source words (Pretest, Next step, Added by practice, Added by you) and state (Working on it, Mastered); Remove and Add work through actions guarded by `requireTeacher`.
- [ ] Implement. Commit `feat: review skills on the student page`.

### Task 7: Data to load (not in repo)
- [ ] Starting-skills SQL from the four workbooks + a match list for Kyla (scratchpad).
- [ ] Review-bank content for the skills kids actually have, per grade, ~10–12 questions each, reviewed by Claude; bank SQL.
- [ ] Skill-tag SQL for the live test-week questions.
