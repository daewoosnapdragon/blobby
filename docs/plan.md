# Winter Practice App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Soft Blobs winter practice app for Snapdragon G1–G4: kid-facing lessons with stars, plus a completion-only teacher view, on Vercel and Supabase.

**Architecture:** A Next.js App Router app in its own repo and Vercel project. All data lives in new `wp_`-prefixed tables inside Pokémon Classroom's existing Supabase project.
- Kids never talk to Supabase directly. Every kid read and write goes through server routes that use the service-role key, and a signed cookie identifies the kid.
- RLS is enabled on every `wp_` table with no anon policies, so the public key can read nothing new.
- The teacher side uses Supabase Auth plus an email allowlist.
- Core rules (answer checking, stars, unlocking, stats, practice picking) are pure functions with unit tests. Database code is a thin layer over them.

**Tech Stack:**
- Next.js 15 (App Router) and React 19
- TypeScript (strict)
- CSS Modules plus CSS variables
- `@supabase/supabase-js` v2 and `@supabase/ssr`
- `zod`, `papaparse`, `qrcode`, `openai` (TTS)
- Vitest with Testing Library, and Playwright

**Spec:** `docs/design.md`, a copy of the Office project doc `claude/winter-practice-app-design.md`. Read it with this plan.

## Global Constraints

**Database**
- New tables only, all prefixed `wp_`. Never alter, rename, or write to any non-`wp_` table.
- Migrations are SQL files that Kyla pastes into the Supabase SQL editor after review. No `supabase db push` against the shared project.
- RLS is enabled on every `wp_` table with zero `anon` and `authenticated` policies. Only server code (the service role) touches them.

**Kids' data**
- Store only: student UUID (from the export), display name, class, blob color, and progress. Never store the Korean name, Korean class, or class number.

**Copy and text**
- American English spelling.
- Sentence case. No `text-transform: uppercase`.

**Design**
- Colors: background `#F7F3EF`, card `#FFFFFF`, ink `#1F1F1F`, muted `#6B655F`, yellow `#FFE59A`/`#FFD95A`, pink `#FFB5C1`, mint `#B7E1D1`, blue `#A9D3FF`, orange `#F97940` (sparkle doodles only).
- Blob colors: Sunny `#FFD95A`, Peach `#FFC9A8`, Pink `#FFB5C1`, Mint `#B7E1D1`, Sky `#A9D3FF`, Grape `#D9CCF5`.
- Fonts: M PLUS Rounded 1c (weights 500/700/800) for the interface. Andika (400/700) for sentences inside questions.
- Card radius 28px. The main action is a black pill button with a 36–44px yellow `#FFD95A` arrow circle.

**Motion**
- `--ease-out: cubic-bezier(0.23,1,0.32,1)` and `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`.
- breathe 3.2s; blink 5s cycle; hop 500ms; wobble 400ms; squish 500ms; button press `scale(0.97)` over 160ms.
- Everything that moves stops under `prefers-reduced-motion: reduce`.
- The mockup canvas (https://claude.ai/artifact/3KraTa4mQJZVVkPUwz3FhX, D screens) is the visual and motion reference.

**Stars and dates**
- Stars: 10 per lesson finished (first time only), a 10-star week bonus (first time only), and 1 per correct free-practice answer. Wrong answers never subtract.
- All "today" logic uses the `Asia/Seoul` date, never the device date. The one exception is the bedtime and morning nudge, which uses device local time.

**Platform**
- Phone first: 390px wide is the reference, and touch targets are at least 44px.

## Review Focus

1. **A retried or double-tapped submit on a flaky phone connection:** stars are awarded once, never zero, never twice. Owned by Task 7 (`completeLesson` is idempotent, and attempts dedupe on `clientAttemptId`).
2. **Siblings sharing a phone who tap "Not you?":** after switching, every write goes to the new kid, including a lesson tab left open from before. Owned by Task 4 (every route reads the cookie per request) and Task 8 (the e2e test switches mid-lesson).
3. **A family away from Korea over break:** week unlocking and day stamps follow Seoul dates whatever the phone's time zone. Owned by Task 5 (`isWeekOpen` and `seoulDate` tests at time-zone edges).
4. **Kyla edits or deletes a question that kids have already answered:** old attempts don't break stats, missed-question practice skips deleted questions, and an in-progress lesson still finishes. Owned by Task 15 (soft delete) and Task 12 (`pickFreePractice` filters deleted).
5. **Audio or a YouTube video fails to load:** the question is still answerable, "Hear it" shows a retry state, and the video step can be skipped. Owned by Task 8 (audio) and Task 14 (video).

---

## File Structure

```
docs/design.md, docs/plan.md
supabase/migrations/0001_wp_init.sql        all wp_ tables, RLS on, no policies
scripts/import-roster.ts                    CSV → wp_classes, wp_students
scripts/import-content.ts                   content JSON → plans/weeks/lessons/questions + audio
scripts/reset-test-stars.ts                 delete star events from test-kind plans
src/lib/types.ts                            shared domain types
src/lib/questions/schema.ts                 zod schemas for the 7 question types
src/lib/questions/check.ts                  checkAnswer
src/lib/roster.ts                           displayNameFrom, parseRoster, makeClassCode, makeLinkSecret
src/lib/session.ts                          signStudent, verifyStudent (HMAC cookie)
src/lib/dates.ts                            seoulDate, isWeekOpen
src/lib/stars.ts                            STAR_VALUES, lessonStars, weekBonusDue
src/lib/practice.ts                         pickFreePractice
src/lib/stats.ts                            computeClassStats, skillHistory
src/lib/scene.ts                            blobScene (holiday hats, snow, sleepy)
src/lib/youtube.ts                          checkEmbeddable
src/lib/tts.ts                              audioKey, synthesize, ensureAudio
src/lib/sound.ts                            playSound, mute state
src/lib/copy.ko.ts                          Korean parent strings (drafts for Kyla)
src/lib/db/admin.ts                         service-role client (server only)
src/lib/db/kid.ts                           kid-side queries and writes
src/lib/db/teacher.ts                       teacher-side queries and writes
src/app/globals.css                         tokens, fonts, motion keyframes
src/components/blob/Blob.tsx + .module.css  the mascot
src/components/ui/*                         PillButton, Card, StarCount, ProblemScreen, MuteToggle
src/components/questions/*                  one component per type + QuestionPlayer
src/app/(kid)/…                             home, join, pick, lesson, practice, week-done, stamps
src/app/s/[secret]/route.ts                 QR login
src/app/api/…                               join, switch, blob, attempt, lesson-complete, ping
src/app/teacher/…                           login, classes, student, cards, plans, editor
tests/unit/*.test.ts(x), tests/e2e/*.spec.ts
```

**Milestones**
- **M1 (Tasks 1–11):** must be working by about Dec 10 for the in-class test weeks.
- **M2 (Tasks 12–17):** lands during the test weeks and before break.

---

### Task 1: Scaffold, design tokens, and the Blob

**Files:**
- Create: the Next app (`create-next-app`, TypeScript, App Router, no Tailwind)
- Create: `src/app/globals.css`, `src/components/blob/Blob.tsx`, `Blob.module.css`, `docs/design.md`, `docs/plan.md`
- Test: `tests/unit/blob.test.tsx`

**Interfaces:**
- Produces:
  - `type BlobColor = 'sunny'|'peach'|'pink'|'mint'|'sky'|'grape'`
  - `BLOB_HEX: Record<BlobColor,string>`
  - `type Mood = 'idle'|'happy'|'oops'|'sleepy'`
  - `<Blob color mood size reaction? hat? />`, where `reaction: 'hop'|'wobble'|'squish'|'cheer'|null` and `hat: 'santa'|'seollal'|null`

- [ ] **Step 1:** Scaffold the app, add Vitest, Testing Library, and Playwright, and copy the spec and this plan into `docs/`.
- [ ] **Step 2:** Write `globals.css`:
  - the color tokens, fonts (Google Fonts `M PLUS Rounded 1c` and `Andika`), and both easing tokens
  - the keyframes `breathe`, `blink`, `glance`, `hop`, `wobble`, `squish`, `cheer`, `pop`, with values taken from the mockup D files
  - a `prefers-reduced-motion: reduce` block that disables every one of them
  - `button:active { transform: scale(0.97) }` and a `:focus-visible` outline of `3px solid #1F1F1F`
- [ ] **Step 3: Write failing tests**
  - `renders face for each mood`: idle has two eye ellipses inside a `.blink` group; happy has arc paths; oops has a sweat-drop path; sleepy has line paths.
  - `fills body with BLOB_HEX[color]`
  - `applies reaction class and re-triggers`: rendering `reaction="hop"` twice with a changed `key` gives a fresh element.
  - `is aria-hidden`
- [ ] **Step 4:** Run `npx vitest run tests/unit/blob.test.tsx`. Expected: FAIL.
- [ ] **Step 5:** Implement `Blob`. Use the SVG path from the mockups (`M58 8 C84 2 112 18 114 48 …`), the cheeks, and the faces. Retrigger reactions by changing `key`.
- [ ] **Step 6:** Run the tests. Expected: PASS. Commit with `feat: scaffold, tokens, Blob mascot`.

### Task 2: Database schema

**Files:**
- Create: `supabase/migrations/0001_wp_init.sql`, `src/lib/types.ts`, `src/lib/db/admin.ts`, `scripts/check-schema.ts`

**Interfaces:**
- Produces these tables (all with `id uuid default gen_random_uuid()` unless noted):
  - `wp_classes(grade int, name text, class_code text unique)`
  - `wp_students(id uuid pk /* from export */, class_id, display_name, blob_color text null, link_secret text unique, created_at)`
  - `wp_plans(title, kind text check (kind in ('test','winter','homework')), created_at)`
  - `wp_plan_assignments(plan_id, class_id null, student_id null, check (num_nonnulls(class_id, student_id) = 1))`
  - `wp_weeks(plan_id, position int, skill text, opens_on date)`
  - `wp_lessons(week_id, position int, title text)`
  - `wp_questions(lesson_id, position int, type text, payload jsonb, audio jsonb default '{}', deleted_at timestamptz null, updated_at)`
  - `wp_attempts(student_id, question_id, client_attempt_id uuid unique, correct bool, context text check (context in ('lesson','free')), created_at)`
  - `wp_lesson_completions(student_id, lesson_id, completed_at, unique(student_id, lesson_id))`
  - `wp_star_events(student_id, plan_id, amount int, reason text check (reason in ('lesson','week_bonus','free_correct')), ref_id uuid, created_at, unique(student_id, reason, ref_id))`
  - `wp_practice_days(student_id, day date, seconds int default 0, primary key(student_id, day))`
- Produces TypeScript types in `types.ts` mirroring each table, plus `getAdmin(): SupabaseClient`. It is server-only: import `server-only`, and use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1:** Write the migration. Every statement targets a `wp_` name, followed by `alter table … enable row level security;` for each table and no `create policy`.
- [ ] **Step 2:** Write `scripts/check-schema.ts`. It connects with the anon key, selects from each `wp_` table, and asserts it gets zero rows or a permission error. Then it connects with the service role and asserts each table exists.
- [ ] **Step 3:** Ask Kyla to paste the SQL into the Supabase SQL editor. **Stop until she confirms.**
- [ ] **Step 4:** Run `npx tsx scripts/check-schema.ts`. Expected: `11 tables ok, anon sees nothing`.
- [ ] **Step 5:** While connected, list the existing non-`wp_` tables that have RLS disabled. Report them to Kyla as a separate note and change nothing.
- [ ] **Step 6:** Commit with `feat: wp_ schema with RLS locked`.

### Task 3: Roster import

**Files:**
- Create: `src/lib/roster.ts`, `scripts/import-roster.ts`
- Test: `tests/unit/roster.test.ts`

**Interfaces:**
- Produces:
  - `displayNameFrom(name: string): string`
  - `parseRoster(csv: string): { classes: {grade: number}[]; students: {id: string; grade: number; displayName: string}[] }`
  - `makeClassCode(): string` (6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`)
  - `makeLinkSecret(): string` (24 random bytes, base64url)

- [ ] **Step 1: Write failing tests.** Use fake names only; never real students.
  - `displayNameFrom('Kim Min Jun (Leo)') === 'Leo'`
  - `displayNameFrom('Ok Ha Neul') === 'Ha Neul'`
  - `displayNameFrom('Park Aurora') === 'Aurora'`
  - `parseRoster` keeps only `English Class === 'Snapdragon'`, `Active === 'Yes'`, and grades 1–4. A grade-5 row is dropped, and the output has no Korean-name field.
  - duplicate display names in one class get a last initial: two "Leo"s become "Leo K." and "Leo P."
  - `makeClassCode()` matches `/^[A-HJ-NP-Z2-9]{6}$/`
  - `makeLinkSecret().length >= 32`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement with `papaparse`. The script reads a CSV path argument and upserts four `wp_classes` rows named `Snapdragon G1`–`G4`, plus the students, generating secrets only for new rows. Re-running doesn't change existing secrets or codes.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Run `npx tsx scripts/import-roster.ts <path to Kyla's CSV>`. Expected: `classes 4, students 53 (12/14/13/14)`. Don't commit the CSV.
- [ ] **Step 6:** Commit with `feat: roster import`.

### Task 4: Kid login and "Not you?"

**Files:**
- Create: `src/lib/session.ts`, `src/app/s/[secret]/route.ts`, `src/app/(kid)/join/page.tsx`, `src/app/api/join/route.ts`, `src/app/api/switch/route.ts`, `src/lib/db/kid.ts` (`studentFromRequest`)
- Test: `tests/unit/session.test.ts`, `tests/e2e/login.spec.ts`

**Interfaces:**
- Produces:
  - `signStudent(id: string): string`
  - `verifyStudent(cookie: string|undefined): string|null`
  - cookie `wp_student`: httpOnly, sameSite `lax`, maxAge 120 days, HMAC-SHA256 with `SESSION_SECRET`
  - `studentFromRequest(): Promise<StudentRow|null>`, which every kid route calls per request
- The join flow:
  - `POST /api/join {code}` returns `{classId, names: {id, displayName, blobColor}[]}`
  - `POST /api/join {code, studentId}` sets the cookie

- [ ] **Step 1: Write failing tests**
  - verify round-trips
  - a tampered cookie returns null
  - a wrong secret returns null
- [ ] **Step 2: Write the e2e test**
  - `/s/<secret>` lands on `/pick` the first time.
  - "Not you?" leads to `/join`; code plus name sets the new kid.
  - The mid-lesson switch test for Review Focus #2 lives in Task 8, once lessons exist.
- [ ] **Step 3:** Run both. Expected: FAIL.
- [ ] **Step 4:** Implement.
  - An unknown secret shows the friendly problem screen with a link to `/join`.
  - The join screen lists names as large tappable chips, each with that kid's blob if one is chosen.
- [ ] **Step 5:** Run both. Expected: PASS. Commit with `feat: QR and class-code login`.

### Task 5: Questions, answer checking, and dates

**Files:**
- Create: `src/lib/questions/schema.ts`, `src/lib/questions/check.ts`, `src/lib/dates.ts`
- Test: `tests/unit/check.test.ts`, `tests/unit/dates.test.ts`

**Interfaces:**
- Produces the payloads (zod, discriminated on `type`):
  - `listen_tap {prompt, audioText, choices: {text, image?}[], answer: number}`
  - `pick_one {prompt, choices: string[], answer: number}`
  - `find_fix {words: string[], wrongIndex: number, fixes: string[], answer: number}`
  - `build_it {prompt, tiles: string[] /* correct order */, distractors?: string[]}`
  - `sort_it {prompt, groups: string[], items: {text, group: number}[]}`
  - `fill_blank {before, after, choices: string[], answer: number}`
  - `watch_answer {youtubeId, questions: NonWatchQuestion[]}`
- Produces `parseQuestion(type, payload): Question`, which throws on invalid input.
- Produces `checkAnswer(q: Question, r: Response): boolean`, where `Response` is:
  - `{choice: number}` for listen_tap, pick_one, fill_blank
  - `{tapped: number, fix: number}` for find_fix
  - `{order: string[]}` for build_it
  - `{placement: number[]}` for sort_it
- Produces `seoulDate(now: Date): string` (YYYY-MM-DD) and `isWeekOpen(opensOn: string, now: Date): boolean`.

- [ ] **Step 1: Write failing tests**
  - Each type has one correct and one incorrect case.
  - find_fix is false if the right fix is chosen after tapping the wrong word.
  - build_it ignores leftover distractors.
  - `parseQuestion` rejects `answer` out of range.
  - **Review Focus #3:**
    - `seoulDate(new Date('2026-12-27T15:30:00Z')) === '2026-12-28'`
    - `isWeekOpen('2026-12-28', new Date('2026-12-27T14:59:00Z')) === false`
    - and `true` at `15:00Z`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Use `Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'})` for `seoulDate`.
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: question schemas, checking, Seoul dates`.

### Task 6: Content import and pre-generated audio

**Files:**
- Create: `src/lib/tts.ts`, `scripts/import-content.ts`, `content/test-plan.json` (sample)
- Test: `tests/unit/content.test.ts`, `tests/unit/tts.test.ts`

**Interfaces:**
- Consumes `parseQuestion` (Task 5).
- Produces the content file shape: `{plan: {title, kind}, assignTo: {grade}, weeks: [{skill, opensOn, lessons: [{title, questions: [{type, ...payload}]}]}]}`.
- Produces:
  - `audioKey(text: string, voice: string): string` (sha256 hex)
  - `synthesize(text): Promise<Buffer>` (OpenAI TTS; model and voice from `TTS_MODEL` and `TTS_VOICE`)
  - `ensureAudio(q): Promise<Record<string,string>>`. It maps each spoken string to a public URL in Storage bucket `wp-audio` at `audio/{key}.mp3` and skips keys that already exist.
- Spoken strings: listen_tap uses `audioText` and each choice. Every type uses its prompt. pick_one and fill_blank also speak each choice.

- [ ] **Step 1: Write failing tests**
  - A content file with a bad question fails validation, naming its week, lesson, and position.
  - `audioKey` is stable, and changes when the text or voice changes.
  - `ensureAudio` calls `synthesize` only for missing keys (mock storage).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the importer. It creates the Storage bucket if missing (public read), upserts plan, weeks, lessons, and questions by `(plan title, week position, lesson position, question position)`, assigns the plan to the class for `assignTo.grade`, then fills `audio`. Before choosing the voice service for real, check its current pricing and note it in the PR.
- [ ] **Step 4:** Run. Expected: PASS. Import `content/test-plan.json` into a dev plan and play one URL.
- [ ] **Step 5:** Commit with `feat: content import with pre-generated audio`.

### Task 7: Stars, progress, and kid data routes

**Files:**
- Create: `src/lib/stars.ts`, `src/app/api/attempt/route.ts`, `src/app/api/lesson-complete/route.ts`, `src/app/api/blob/route.ts`
- Extend: `src/lib/db/kid.ts`
- Test: `tests/unit/stars.test.ts`, `tests/integration/progress.test.ts`

**Interfaces:**
- Produces:
  - `STAR_VALUES = {lesson: 10, weekBonus: 10, freeCorrect: 1}`
  - `weekBonusDue(lessonIds: string[], completedIds: Set<string>): boolean`
- Produces from `kid.ts`:
  - `getHome(studentId): Promise<HomeData>`, where `HomeData` = `{student, totalStars, plan: {id, title}, weeks: {id, skill, opensOn, open, done, lessons: {id, title, done}[]}[], currentWeekId}`
  - `recordAttempt(studentId, {clientAttemptId, questionId, correct, context}): Promise<{starsAwarded: number}>`
  - `completeLesson(studentId, lessonId): Promise<{starsAwarded: number, weekDone: boolean}>`
  - `setBlobColor(studentId, color: BlobColor)`
- Total stars only count plans assigned to the student. Test-plan stars count until the reset (Task 17).

- [ ] **Step 1: Write failing tests**
  - `weekBonusDue` is true only when every lesson is complete.
  - **Review Focus #1** (against a seeded dev schema):
    - `completeLesson` called twice gives `starsAwarded` 10, then 0.
    - Completing the last lesson twice awards the week bonus once.
    - `recordAttempt` with the same `clientAttemptId` twice stores one row and awards one free star.
    - Concurrent `completeLesson` calls via `Promise.all` give a total of 10.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement using the unique constraints. Insert with `on conflict do nothing` and award stars only when the insert returned a row. Routes return 401 with no valid cookie, and the client shows the "who are you?" problem screen.
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: idempotent stars and progress`.

### Task 8: Kid screens (pick, home, lesson player, week done)

**Files:**
- Create:
  - `src/app/(kid)/pick/page.tsx`, `src/app/(kid)/page.tsx`
  - `src/app/(kid)/lesson/[id]/page.tsx`, `src/app/(kid)/week-done/[weekId]/page.tsx`
  - `src/components/questions/{ListenTap,PickOne,FindFix,BuildIt,SortIt,FillBlank,QuestionPlayer}.tsx`
  - `src/components/ui/{PillButton,Card,StarCount,HearIt}.tsx`
- Test: `tests/unit/questions.test.tsx`, `tests/e2e/lesson.spec.ts`

**Interfaces:**
- Consumes `getHome`, `recordAttempt`, `completeLesson`, `checkAnswer`, and `Blob`.
- Produces `<QuestionPlayer questions onAnswer(q, correct) onFinish />`, which Tasks 12 and 14 reuse.

Build each screen to match the D mockups.
- **Pick:**
  - six swatches, with `role=radio`
  - the big blob squishes on change
  - "That's me!" saves the color
- **Home:**
  - top bar with blob, "Hi, {name}!", and star pill
  - "this week" card whose blob squishes when poked
  - week rail: check / you-are-here / locked "Opens {weekday}" / treasure chest last
  - free practice card (links to `/practice`; that page is Task 12)
- **Lesson:**
  - progress bar and the question card with the blob and "Hear it"
  - immediate feedback: hop with mint card when right, wobble with pink card when wrong
  - the kid retries a wrong answer until correct; only the first try is stored as the attempt
- **Week done:**
  - double jump, sparkles staggered by 50ms, a stars count-up over 900ms
  - the chest total and "Opens when you're back at school"

- [ ] **Step 1: Write failing tests**
  - Each question component calls `onAnswer` with the `checkAnswer` result.
  - find_fix shows its fixes only after the wrong word is tapped.
  - build_it moves a tile back when it's tapped in the answer row.
  - **Review Focus #5:** HearIt with an audio URL that errors shows "Try again" and keeps the question answerable.
- [ ] **Step 2: Write the e2e test**
  - log in, pick Mint
  - on home, see "Mint" blob color fill `#B7E1D1`
  - finish a 2-question lesson; the star pill increases by 10
  - finish the week's last lesson; the week-done screen shows +20
  - **Review Focus #2:** open a lesson as kid A in tab 1, switch to kid B in tab 2, submit an answer in tab 1. Assert that the attempt is stored for B, and that tab 1's next screen shows B's name.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement. Answer submits retry up to 3 times with the same `clientAttemptId`. Stars fly from the answer to the pill using a transform only, and are skipped under reduced motion.
- [ ] **Step 5:** Run. Expected: PASS. Commit with `feat: kid screens and lesson player`.

### Task 9: Teacher login, class view, and student view

**Files:**
- Create: `src/lib/stats.ts`, `src/lib/db/teacher.ts`, `src/app/teacher/login/page.tsx`, `src/app/teacher/page.tsx`, `src/app/teacher/class/[id]/page.tsx`, `src/app/teacher/student/[id]/page.tsx`, `src/middleware.ts`
- Test: `tests/unit/stats.test.ts`

**Interfaces:**
- Produces `computeClassStats(input: {students, starEvents, practiceDays, completions, lessons: {id, weekId, weekSkill}[], attempts: {studentId, questionId, lessonId, createdAt}[]}): {studentId, displayName, blobColor, stars, daysPracticed, secondsPracticed, weeksDone, lastSkill: string|null}[]`.
- Produces `skillHistory(studentId, …): {skill: string, dates: string[]}[]`.
- Teacher pages require a Supabase Auth session whose email is in `TEACHER_EMAILS`. Anyone else is redirected to login.

- [ ] **Step 1: Write failing tests**
  - star sums per student
  - days = distinct `practice_days` rows
  - a week counts as done only when all its lessons are complete
  - `lastSkill` comes from the newest attempt
  - **Review Focus #4:** attempts whose question was soft-deleted still count toward `lastSkill` and days
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The class list shows each kid's blob and name, plus stars, days, time (`h:mm`), weeks done, and last skill, with tabular numbers. The student page shows only the skill history. No scores.
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: teacher completion view`.

### Task 10: QR cards and link reissue

**Files:**
- Create: `src/app/teacher/class/[id]/cards/page.tsx`, `src/lib/copy.ko.ts`
- Extend: `teacher.ts` (`reissueLink(studentId): Promise<string>`)
- Test: `tests/unit/cards.test.tsx`

- [ ] **Step 1: Write failing tests**
  - a card renders the name, the QR SVG encoding `${APP_URL}/s/${secret}`, the class code, and the Korean instructions from `copy.ko.ts`
  - after `reissueLink`, the old secret no longer resolves
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement an A4 print layout: 8 cards per page, with the kid's blob in their color if they've chosen one. `copy.ko.ts` holds draft parent instructions marked `// DRAFT: Kyla to confirm`.
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: printable QR cards`.

### Task 11: Problem screens, sounds, and mute (end of M1)

**Files:**
- Create: `src/components/ui/{ProblemScreen,MuteToggle}.tsx`, `src/lib/sound.ts`, `public/sounds/{pop,ding,boop,squeak}.mp3`, `src/app/(kid)/error.tsx`, `src/app/(kid)/loading.tsx`
- Test: `tests/unit/sound.test.ts`

- [ ] **Step 1: Write failing tests**
  - `playSound` does nothing while muted
  - mute persists in `localStorage` key `wp_muted`, with reads wrapped in try/catch
  - the offline screen shows when `navigator.onLine` is false
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - Loading: the blob bounces.
  - Offline: the blob holds an umbrella.
  - Error: a calm message with "Try again."
  - Sounds: pop on taps, ding when right, boop when wrong, squeak on a blob poke.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Run the full suite and the e2e tests, deploy to Vercel, import the test plan and Week 1 content, and print cards for one class. Commit with `feat: problem screens and sound`.

### Task 12: Free practice and missed questions

**Files:**
- Create: `src/lib/practice.ts`, `src/app/(kid)/practice/page.tsx`
- Extend: `src/lib/db/kid.ts` (`getMissedIds`)
- Test: `tests/unit/practice.test.ts`

**Interfaces:**
- Produces `pickFreePractice(pool: {id, deleted: boolean}[], missedIds: Set<string>, n = 8, rand = Math.random): string[]`.
  - The pool is every question from open weeks.
  - Missed questions carry 3× weight.
  - No duplicates in one set.
  - Deleted questions are excluded.
- Produces `getMissedIds(studentId): Promise<Set<string>>` in `kid.ts`: questions whose latest attempt by this kid is incorrect. A question leaves the set once the kid's latest attempt on it is correct.

- [ ] **Step 1: Write failing tests**
  - over 1,000 seeded runs, a missed question appears about 3× as often (between 2.5× and 3.5×)
  - deleted ids never appear (**Review Focus #4**)
  - returns `min(n, pool size)` unique ids
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The page runs `QuestionPlayer` with `context: 'free'`, awarding 1 star per correct answer through `recordAttempt`.
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: free practice`.

### Task 13: Day stamps and time practiced

**Files:**
- Create: `src/app/api/ping/route.ts`, `src/app/(kid)/stamps/page.tsx`
- Extend: `kid.ts` (`ping(studentId, now)`)
- Test: `tests/integration/ping.test.ts`

- [ ] **Step 1: Write failing tests**
  - `ping` upserts `practice_days` for the `seoulDate(now)` row and adds 30 seconds
  - seconds cap at 10,800 per day
  - an attempt also marks the day
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - lesson and practice screens ping every 30s while `document.visibilityState === 'visible'`
  - the stamps page is a month calendar, one stamp per practiced day in the kid's blob color, linked from home under the week rail
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: day stamps and practice time`.

### Task 14: Watch and answer

**Files:**
- Create: `src/lib/youtube.ts`, `src/components/questions/WatchAnswer.tsx`
- Test: `tests/unit/youtube.test.ts`, `tests/unit/watch.test.tsx`

**Interfaces:**
- Produces `checkEmbeddable(urlOrId: string): Promise<{ok: true, id: string} | {ok: false, reason: 'not_found'|'not_embeddable'|'bad_url'}>`. It calls `https://www.youtube.com/oembed?url=…&format=json`: 401 means `not_embeddable`, 404 means `not_found`.

- [ ] **Step 1: Write failing tests**
  - `checkEmbeddable` parses `youtu.be`, `watch?v=`, and bare ids, and maps 200/401/404 (mocked fetch)
  - **Review Focus #5:** if the player fails to load, a "Skip video" button appears and the follow-up questions stay playable
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Embed `https://www.youtube-nocookie.com/embed/{id}?rel=0&modestbranding=1`, followed by the inner questions in `QuestionPlayer`.
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: watch and answer`.

### Task 15: Question editor and plan setup

**Files:**
- Create: `src/app/teacher/plans/page.tsx`, `src/app/teacher/editor/[lessonId]/page.tsx`
- Extend: `teacher.ts` (`saveQuestion`, `softDeleteQuestion`, `setWeek`)
- Test: `tests/integration/editor.test.ts`

**Interfaces:**
- Produces:
  - `saveQuestion(lessonId, position, type, payload): Promise<void>`. It validates with `parseQuestion`, then calls `ensureAudio`.
  - `softDeleteQuestion(id)`, which sets `deleted_at`
  - `setWeek(weekId, {skill, opensOn})`

- [ ] **Step 1: Write failing tests**
  - saving changed text produces a new audio key
  - saving unchanged text calls no synthesis
  - a YouTube link failing `checkEmbeddable` is rejected with a readable message
  - **Review Focus #4:** soft-deleting a question in a lesson a kid has half done still lets `completeLesson` succeed, and the lesson player skips deleted questions
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - one form per question type
  - a live preview using the kid component
  - plan setup lists each class's weeks with editable skill and open date
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: editor and plan setup`.

### Task 16: Seasons, holidays, and time of day

**Files:**
- Create: `src/lib/scene.ts`
- Modify: home and Blob usage
- Test: `tests/unit/scene.test.ts`

**Interfaces:**
- Produces `blobScene(now: Date, localHour: number): {snow: boolean, hat: 'santa'|'seollal'|null, nudge: 'morning'|'bedtime'|null}`.
  - `snow`: true when the Seoul date is between Dec 20 and Feb 28.
  - `hat`: `santa` on Dec 24–25 (Seoul); `seollal` on 2027-02-06 through 02-09, from the `SEOLLAL_DATES` list (checked: Seollal is Feb 7, 2027, with the holiday Feb 6–9).
  - `nudge`: `morning` when `localHour < 9`; `bedtime` when `localHour >= 21`.

- [ ] **Step 1: Write failing tests**
  - each boundary above
  - `bedtime` doesn't block anything; the home screen still renders "Keep going"
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - snow: a CSS-only flake layer, off under reduced motion
  - hats: SVG overlays on the Blob
  - bedtime: pajamas plus "Time for bed, see you tomorrow!"
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: seasons and time of day`.

### Task 17: Reset test stars before break

**Files:**
- Create: `scripts/reset-test-stars.ts`
- Test: `tests/integration/reset.test.ts`

- [ ] **Step 1: Write the failing test.** After a reset:
  - star events on `kind='test'` plans are gone
  - `practice_days`, blob colors, and winter-plan stars are untouched
  - the test plan's assignments are removed, so it stops showing on home
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with a `--dry-run` flag that prints counts. **Kyla runs it herself** after reviewing the dry run.
- [ ] **Step 4:** Run. Expected: PASS. Commit with `feat: test star reset`.

---

## Spec coverage

| Spec section | Task |
|---|---|
| §5.1 | 4, 10 |
| §5.2 | 8 |
| §5.3 | 8, 13 |
| §5.4 | 6, 7, 15 |
| §5.5 | 12 |
| §5.6 | 5, 8, 14 |
| §5.7 | 6, 8 |
| §5.8 | 7, 8 |
| §5.9 | 11, 16 |
| §5.10–5.11 | 1, 8 |
| §6 | 9, 10, 15 |
| §7 | 3, 4, 10 |
| §8 | 6 (content drafting is a separate Claude-and-Kyla step, not code) |
| §9 | 2 (`wp_plan_assignments` allows single students) |
| §10 | 11, 17 |
