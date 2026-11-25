# Teacher Password Sign-in and Account Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kyla signs in to `/teacher` with email + password, sets her name and password on `/teacher/account`, and sees "Hi, <name>" in the teacher top bar.

**Architecture:** Supabase Auth does the work: `signInWithPassword` for sign-in, `updateUser` for password and for the name (stored in `user_metadata.display_name`). Pure validation and error-mapping helpers live in one small module; server actions in `src/app/teacher/actions.ts` call them and redirect with query params, the same pattern as the student rename. No database changes.

**Tech Stack:** Next.js 15 App Router (server actions), `@supabase/ssr` / `@supabase/supabase-js` v2, React 19, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-teacher-password-account-design.md`

## Global Constraints

- Allowlist (`TEACHER_EMAILS`) is re-checked on every teacher page and action; nothing here weakens that.
- Wrong password, unknown user, and non-allowlisted email all give the same message: "That email and password didn't work."
- A non-allowlisted email is never sent to Supabase for password sign-in.
- Name: 1–60 characters after trimming. Password: at least 8 characters, typed twice, must match.
- The sign-in email cannot be changed from the app.
- Magic-link sign-in stays, unchanged in behavior, as "Email me a link instead".
- No new tables or migrations.

## Review Focus

1. Someone types a password with no email allowlist match → no Supabase call, neutral error (Task 2 test `never calls Supabase for an email not on the list`).
2. Supabase accepts a password for an account whose email was later removed from `TEACHER_EMAILS` → signed straight back out, neutral error (Task 2 test `signs out a Supabase user who is not on the list`).
3. Supabase not configured (e2e server, misconfigured deploy) → password sign-in answers the neutral error instead of crashing (Task 2 e2e `password sign-in fails neutrally without Supabase`).
4. The project has "secure password change" on, so `updateUser({ password })` returns `reauthentication_needed` → a clear "sign in again with an email link" message, not a crash (Task 1 `passwordError` + Task 3 view test).
5. A name of only spaces, or 61+ characters, or a name with surrounding spaces → rejected / trimmed (Task 1 `validateName` tests).

---

### Task 1: Account helpers

**Files:**
- Create: `src/lib/teacherAccount.ts`
- Test: `tests/unit/teacherAccount.test.ts`

**Interfaces:**
- Produces:
  - `NAME_MAX = 60`, `PASSWORD_MIN = 8`
  - `validateName(raw: unknown): string | null` — trimmed name, or null if empty / longer than `NAME_MAX`.
  - `type PasswordProblem = 'short' | 'mismatch'`
  - `validatePassword(pw: unknown, confirm: unknown): PasswordProblem | null`
  - `type PasswordError = 'reauth' | 'weak' | 'same' | 'failed'`
  - `passwordError(err: { code?: string } | null | undefined): PasswordError` — maps Supabase `code`: `reauthentication_needed`→`reauth`, `weak_password`→`weak`, `same_password`→`same`, anything else→`failed`.
  - `teacherName(user: { user_metadata?: Record<string, unknown> } | null | undefined): string | null` — `user_metadata.display_name` if it is a non-empty string after trim, else null.

- [ ] **Step 1: Write the failing tests** in `tests/unit/teacherAccount.test.ts`:
  - `validateName('  Kyla  ')` → `'Kyla'`; `validateName('   ')` → `null`; `validateName('a'.repeat(60))` → 60 chars; `validateName('a'.repeat(61))` → `null`; `validateName(undefined)` → `null`.
  - `validatePassword('1234567', '1234567')` → `'short'`; `validatePassword('12345678', '12345679')` → `'mismatch'`; `validatePassword('12345678', '12345678')` → `null`; `validatePassword(undefined, undefined)` → `'short'`.
  - `passwordError({ code: 'reauthentication_needed' })` → `'reauth'`; `{ code: 'weak_password' }` → `'weak'`; `{ code: 'same_password' }` → `'same'`; `{}` and `null` → `'failed'`.
  - `teacherName({ user_metadata: { display_name: ' Kyla ' } })` → `'Kyla'`; `{ user_metadata: { display_name: '' } }`, `{ user_metadata: { display_name: 5 } }`, `{}`, `null` → `null`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/teacherAccount.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/teacherAccount.ts` with the exports above. Pure, no imports from Next or Supabase. Validation of length uses the trimmed string; passwords are **not** trimmed.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: teacher account helpers`.

### Task 2: Password sign-in

**Files:**
- Modify: `src/app/teacher/actions.ts` (add `signInWithPassword`)
- Modify: `src/app/teacher/login/page.tsx`
- Modify: `tests/e2e/teacher.spec.ts`
- Test: `tests/unit/teacherSignIn.test.ts`

**Interfaces:**
- Consumes: `isTeacherEmail` (`src/lib/teacherAuth.ts`), `teacherSupabase` (`src/lib/supabase/server.ts`).
- Produces: server action `signInWithPassword(formData: FormData): Promise<void>` reading `email` and `password`. On success `redirect('/teacher')`; on any failure `redirect('/teacher/login?error=signin')`.

- [ ] **Step 1: Write the failing unit tests** in `tests/unit/teacherSignIn.test.ts`. Mock `next/navigation` so `redirect` throws `new Error('REDIRECT:' + url)`, mock `next/cache` (`revalidatePath: vi.fn()`), and mock `@/lib/supabase/server` so `teacherSupabase` returns a fake with `auth.signInWithPassword`, `auth.signOut` as `vi.fn()`. Set `process.env.TEACHER_EMAILS = 'kyla@example.com'`. Tests:
  - `signs an allowlisted teacher in and goes to /teacher`: `signInWithPassword` resolves `{ data: { user: { email: 'kyla@example.com' } }, error: null }`; form `email=' Kyla@Example.com '`, `password='secret123'` → rejects with `REDIRECT:/teacher`; Supabase called with `{ email: 'kyla@example.com', password: 'secret123' }`.
  - `never calls Supabase for an email not on the list`: `stranger@example.com` → `REDIRECT:/teacher/login?error=signin`; `signInWithPassword` not called.
  - `wrong password gives the neutral error`: Supabase resolves `{ data: { user: null }, error: { code: 'invalid_credentials' } }` → `REDIRECT:/teacher/login?error=signin`.
  - `signs out a Supabase user who is not on the list`: Supabase returns user `other@example.com` with no error → `signOut` called, `REDIRECT:/teacher/login?error=signin`.
  - `fails neutrally when Supabase is not configured`: `teacherSupabase` resolves `null` → `REDIRECT:/teacher/login?error=signin`.
  - `empty password fails without calling Supabase`.
- [ ] **Step 2: Add the failing e2e tests** to the `teacher side fails closed` describe in `tests/e2e/teacher.spec.ts`:
  - `login shows email and password sign-in`: `/teacher/login` has `getByLabel('Email')`, `getByLabel('Password')`, button `Sign in`, button `Email me a link instead`.
  - `password sign-in fails neutrally without Supabase`: fill email `kyla@example.com`, password `whatever1`, click `Sign in` → URL matches `/error=signin/`, `getByRole('alert')` has text `That email and password didn't work.`
  - Update the existing `login gives the same neutral answer for any email` test to click `Email me a link instead` (password left empty).
  - Add `/teacher/account` to the list of paths that redirect to login.
- [ ] **Step 3:** Run `npx vitest run tests/unit/teacherSignIn.test.ts`. Expected: FAIL (`signInWithPassword` not exported).
- [ ] **Step 4: Implement `signInWithPassword`** in `src/app/teacher/actions.ts`. Same email normalisation and shape check as `requestLink`; require a non-empty password; check `isTeacherEmail` **before** calling Supabase; after a successful call, re-check `isTeacherEmail(data.user?.email)` and `signOut()` if it fails. Catch thrown Supabase errors and treat them as failure. `redirect` must be called outside the `try` (it throws).
- [ ] **Step 5: Update the login page.** One form, one `Email` field, a `Password` field (`type="password"`, `autoComplete="current-password"`, `required`), primary button `Sign in` (`formAction={signInWithPassword}`, `className={styles.solid}`), and a secondary button `Email me a link instead` (`formAction={requestLink}`, `formNoValidate` so the empty password doesn't block it, `className={styles.ghost}`). Subtitle: "Sign in with your email and password." Add under the buttons a small `styles.sub` line: "First time, or forgot your password? Use an email link, then set a password on your Account page." Errors: `error=signin` → `role="alert"` "That email and password didn't work."; existing `error=link` message unchanged; `sent=1` message unchanged.
- [ ] **Step 6:** Run `npx vitest run tests/unit/teacherSignIn.test.ts` (PASS) and `npx playwright test tests/e2e/teacher.spec.ts --trace off` (PASS).
- [ ] **Step 7:** Commit `feat: teacher password sign-in`.

### Task 3: Account page and greeting

**Files:**
- Modify: `src/lib/supabase/server.ts` (add `requireTeacherUser`, make `requireTeacher` use it)
- Modify: `src/app/teacher/actions.ts` (add `saveTeacherName`, `changePassword`)
- Create: `src/app/teacher/account/page.tsx`
- Create: `src/app/teacher/account/AccountView.tsx`
- Modify: `src/app/teacher/views.tsx` (`TeacherShell`)
- Modify: every page that renders `TeacherShell`: `src/app/teacher/page.tsx`, `plans/page.tsx`, `editor/[lessonId]/page.tsx`, `class/[id]/page.tsx`, `class/[id]/cards/page.tsx`, `student/[id]/page.tsx`
- Modify: `src/app/teacher/teacher.module.css` (only what the account page needs)
- Modify: `docs/teacher-login.md`
- Test: `tests/unit/teacherAccountPage.test.tsx`, extend `tests/unit/teacherSignIn.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; `teacherSupabase`.
- Produces:
  - `requireTeacherUser(): Promise<{ email: string; name: string | null }>` in `src/lib/supabase/server.ts`; redirects to `/teacher/login` like `requireTeacher`. `requireTeacher()` keeps its signature and returns `(await requireTeacherUser()).email`.
  - `TeacherShell` gains prop `who?: string` and `current` gains `'account'`. When `signOut` is set: nav shows `Classes`, `Plans`, `Account` (`/teacher/account`); if `who` is set, a `Hi, {who}` text sits before Sign out.
  - Server actions `saveTeacherName(formData)` (field `name`) and `changePassword(formData)` (fields `password`, `confirm`). Both call `requireTeacher()` first.
    - name: invalid → `/teacher/account?error=name`; Supabase error → `?error=failed`; ok → `updateUser({ data: { display_name } })`, `revalidatePath('/teacher', 'layout')`, `?saved=name`.
    - password: `validatePassword` problem → `?error=short|mismatch`; Supabase error → `?error=${passwordError(err)}`; ok → `?saved=password`.
  - `AccountView({ email, name, saved, error }: { email: string; name: string | null; saved?: string; error?: string })` — presentational.

- [ ] **Step 1: Write the failing view tests** in `tests/unit/teacherAccountPage.test.tsx` (render `AccountView`, and `TeacherShell` with a noop `signOut`):
  - shows the email as plain text (not an input) and a `Name` input prefilled with `name`, `maxLength` 60.
  - has `New password` and `Type it again` inputs (`type="password"`, `autoComplete="new-password"`, `minLength` 8), and buttons `Save name`, `Save password`.
  - `saved='name'` → status text `Name saved.`; `saved='password'` → `Password saved. Use it next time you sign in.`
  - each `error` value shows its `role="alert"` text: `name` → `Enter a name from 1 to 60 characters.`; `short` → `Use at least 8 characters.`; `mismatch` → `The two passwords don't match.`; `reauth` → `For safety, sign in again with an email link, then set your password.`; `weak` → `That password is too easy to guess. Try a longer one.`; `same` → `That's already your password.`; `failed` → `That didn't save. Try again.`; an unknown value shows nothing.
  - `TeacherShell` with `who="Kyla"` shows `Hi, Kyla` and an `Account` link to `/teacher/account`; with `current="account"` that link has `aria-current="page"`; without `who` there is no `Hi,` text.
- [ ] **Step 2: Extend `tests/unit/teacherSignIn.test.ts`** with action tests. The `@/lib/supabase/server` mock also exports `requireTeacher: vi.fn()` (default resolves `'kyla@example.com'`) and the fake client gains `auth.updateUser: vi.fn()` (default resolves `{ data: {}, error: null }`):
  - `saveTeacherName` with `'  Kyla '` → `updateUser({ data: { display_name: 'Kyla' } })`, `REDIRECT:/teacher/account?saved=name`; with `'   '` → `?error=name`, no `updateUser`.
  - `changePassword` mismatch → `?error=mismatch`, no `updateUser`; short → `?error=short`; ok → `updateUser({ password: 'longenough' })`, `?saved=password`; Supabase `{ error: { code: 'reauthentication_needed' } }` → `?error=reauth`.
  - both stop without calling `updateUser` when `requireTeacher` rejects with `REDIRECT:/teacher/login` (the rejection propagates).
  - (The allowlist logic inside `requireTeacherUser` is covered by the e2e `/teacher/account` redirect in Task 2.)
- [ ] **Step 3:** Run `npx vitest run tests/unit/teacherAccountPage.test.tsx tests/unit/teacherSignIn.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** `requireTeacherUser` (name via `teacherName(data.user)`), the two actions, `AccountView`, and `account/page.tsx` (`dynamic = 'force-dynamic'`, metadata title `Account`, reads `saved`/`error` from `searchParams`, renders inside `TeacherShell current="account"`). Layout: `h1` "Your account", a card per form (Name, Password) reusing existing teacher styles; the email line reads "Signed in as {email}" with a note "To change it, ask whoever runs the app's settings." Update `TeacherShell` and pass `who={me.name ?? me.email}` from every page listed above (replace `await requireTeacher()` with `const me = await requireTeacherUser()` there).
- [ ] **Step 5:** Run the Step 3 command (PASS), then the whole unit suite `npm test` (PASS) and `npx tsc --noEmit` (no errors).
- [ ] **Step 6: Update `docs/teacher-login.md`:** sign-in is now email + password; first time (or forgotten password) use "Email me a link instead", then set a password on Account; alternatively set a password when adding the user in Supabase (**Authentication → Users → Add user**); if **Authentication → Providers → Email → Secure password change** is on, a password change needs a recent sign-in, and the account page says so; the email can't be changed in the app.
- [ ] **Step 7:** Run `npx playwright test tests/e2e/teacher.spec.ts --trace off` (PASS).
- [ ] **Step 8:** Commit `feat: teacher account page and greeting`.
