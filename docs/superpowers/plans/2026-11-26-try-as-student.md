# Try It as a Student Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher button that signs into the kid screens as a hidden per-class practice student who sees every week unlocked, plus a reset.

**Architecture:** A flagged row in `wp_students` (`is_preview`), created on demand by a teacher server action that sets the existing kid session cookie. Kid queries open every week for that row; teacher and join queries skip it.

**Tech Stack:** Next.js 15 server actions, postgres.js, Vitest (unit + integration on local Postgres), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-try-as-student-design.md`

## Global Constraints
- Real kids' behavior is unchanged: their weeks still open by date, `null` dates stay locked.
- The practice student never appears in: `listClasses` counts and stars, `classStats`, `cardsForClass`, `classByCode`; `studentForJoin` returns null for it.
- Both actions call `requireTeacher()` first and validate `classId` with `UUID_RE`.
- At most one practice student per class (database-enforced).
- Display name: `Teacher`.

## Review Focus
1. Two quick clicks on the button create two practice students → unique index + `on conflict` makes the second a no-op (Task 2 test `creates the practice student once`).
2. A kid types the class code on /join → the practice student is not in the list and cannot be chosen by id (Task 2 tests).
3. A practice student in a class whose plan has a week with no date → that week is open for it, still locked for a real kid (Task 2 test).
4. Reset while the practice student is signed in elsewhere → next load shows zero stars and the blob picker (Task 2 test checks rows are gone and `blob_color` is null).
5. Someone not signed in as a teacher posts the action → redirected to login, nothing created (Task 3 relies on `requireTeacher`; unit test asserts it is called first).

---

### Task 1: Migration
**Files:** Create `supabase/migrations/0002_preview_student.sql`; Modify `tests/integration/helpers/db.ts` (apply every `supabase/migrations/*.sql` in name order); Modify `src/lib/types.ts` (`WpStudent.is_preview: boolean`); Test `tests/integration/schema.test.ts`.
- [ ] Failing test `practice students: is_preview defaults to false and only one per class`: insert a student without the column → `is_preview` false; two `is_preview = true` rows in one class → second insert rejects.
- [ ] Run `npx vitest run --config vitest.integration.config.ts tests/integration/schema.test.ts` → FAIL.
- [ ] Migration: `alter table wp_students add column is_preview boolean not null default false;` and `create unique index wp_students_one_preview_per_class on wp_students (class_id) where is_preview;`. Helper applies all migrations.
- [ ] Run → PASS. Commit `feat: practice student flag`.

### Task 2: Data layer
**Files:** Modify `src/lib/db/kid.ts`, `src/lib/db/teacher.ts`; Test `tests/integration/preview.test.ts`.
**Produces:** `practiceStudentFor(classId: string): Promise<WpStudent>` (find or create; `null` class → `NotFoundError`), `resetPracticeStudent(classId: string): Promise<void>` in `teacher.ts`.
- [ ] Failing tests (seed fixture + a practice student via `practiceStudentFor(CLASS.id)`):
  - `creates the practice student once`: two parallel calls → same id; one row with `is_preview`.
  - `is hidden from teacher lists`: `listClasses` kidCount unchanged (3); `classStats` rows exclude it; `cardsForClass` excludes it.
  - `is hidden from join`: `classByCode('ABC234')` names exclude it; `studentForJoin('ABC234', id)` → null.
  - `sees every week`: a week with `opens_on` in 2099 and one with `null` → open in `getHome` for the practice student, closed for Mina; `getLesson` on the 2099 lesson works for it and throws `NotFoundError` for Mina.
  - `reset clears progress`: after `completeLesson` + `recordAttempt` + `setBlobColor`, `resetPracticeStudent` → no attempts, completions, star events, practice days; `blob_color` null; student row kept.
- [ ] Run → FAIL.
- [ ] Implement. `weekIsOpen(opensOn, now, preview)` returns true when `preview`; every caller passes the student's `is_preview` (load it once per function). Teacher/join queries add `and not is_preview`. `practiceStudentFor` inserts with `makeLinkSecret()` and `on conflict do nothing`, then selects.
- [ ] Run this file, then the whole integration suite → PASS. Commit `feat: practice student data`.

### Task 3: Buttons and bar
**Files:** Modify `src/app/teacher/actions.ts` (`tryAsStudent(formData)`, `resetPracticeStudentAction(formData)`), `src/app/teacher/views.tsx` (`ClassListView` gets the two buttons), `src/app/(kid)/layout.tsx` (async; renders `PracticeBar` for a practice student), Create `src/components/ui/PracticeBar.tsx`; Test `tests/unit/practiceStudent.test.tsx`, extend `tests/unit/teacherSignIn.test.ts`.
- [ ] Failing tests: `ClassListView` shows buttons `Try it as a student` and `Reset practice student` (forms with hidden `classId`); `PracticeBar` shows "You're trying this as a student" and a `Back to your class` link to `/teacher/class/<id>`; `tryAsStudent` with a non-teacher (`requireTeacher` rejects) creates nothing.
- [ ] Run → FAIL. Implement (`tryAsStudent` sets `SESSION_COOKIE` via `cookies()` with `signStudent` and `sessionCookieOptions()`, redirects with `landingPath`; reset redirects to the class page with `?reset=1` and a status line).
- [ ] Run unit suite, `npx tsc --noEmit`, teacher e2e → PASS. Commit `feat: try it as a student`.
