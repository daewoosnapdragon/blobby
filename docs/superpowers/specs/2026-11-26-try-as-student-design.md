# "Try it as a student": design

**Why:** Kyla wants to see and play the app exactly as a kid does (home, weeks, lessons, stars) without signing in
as a real kid, whose record would then show her practice.

**Approved:** Nov 26, 2026 (in conversation).

## Goals
- A **Try it as a student** button on each class page signs Kyla into the kid screens as that class's practice
  student, the same way a QR card does.
- One practice student per class, created on first use, named "Teacher", marked `is_preview` in `wp_students`.
- Hidden wherever real kids appear: the class list and stats, the Classes page counts and stars, QR cards, the
  join page's name list. It cannot be signed into by class code.
- The practice student sees **every week of its class's plans unlocked**, dated or not, so Kyla can try any
  lesson now. Real kids are unchanged.
- On kid screens, a thin bar says "You're trying this as a student" with **Back to your class**.
- **Reset practice student** on the class page clears its attempts, finished lessons, stars, practice days and
  blob color.

## Non-goals
- More than one practice student per class; a preview of another teacher's view; previewing a single question.

## Approaches
- **Hidden real student (picked):** the kid screens all need a student record (stars, completions, stamps), so
  a hidden one shows exactly what kids get.
- A no-save preview mode: would need a second code path through every kid screen. Rejected.

## Design
- Migration `0002_preview_student.sql`: `is_preview boolean not null default false`, and a partial unique index
  so a class has at most one practice student. Kyla runs it in the SQL editor; tests and e2e apply every
  migration in order.
- Server actions (teacher-only): `tryAsStudent(classId)` finds or creates the practice student, sets the kid
  session cookie, redirects to `/pick` or `/`. `resetPracticeStudent(classId)` clears its progress.
- Week unlocking: one check, `weekIsOpen(opensOn, now, preview)`, used by every kid query; `preview` comes from
  the student row.
- Hidden: `listClasses`, `classStats`, `cardsForClass`, `classByCode` and `studentForJoin` skip `is_preview` rows.
- The bar lives in the kid layout and shows only for a practice student.

## Left to the builder
- Copy and look of the bar and buttons, within the teacher and kid styles.
