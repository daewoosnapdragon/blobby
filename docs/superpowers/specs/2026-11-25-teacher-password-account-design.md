# Teacher password sign-in and account page: design

**Why:** Kyla can only get into `/teacher` by emailing herself a magic link every time. She wants a normal
sign-in with a password, to set and change that password herself, and to set her name, shown on the teacher pages.

## Goals
- Email + password sign-in on `/teacher/login`.
- An account page where Kyla sets her name and sets or changes her password.
- "Hi, <name>" in the teacher top bar.

## Non-goals
- Showing the teacher's name to kids or parents (QR cards, kid screens).
- Changing the sign-in email from the app (it is tied to `TEACHER_EMAILS`; changing it could lock her out).
- A separate password-reset screen.

## Anti-goals
- Leaking which emails are allowed in.
- Any path that lets someone not on `TEACHER_EMAILS` in.

## Approaches
- **Supabase Auth passwords + name in user metadata (picked).** Built in, no new tables, the existing session and
  middleware keep working.
- Own password table: rebuilds what Supabase already does, more to secure. Rejected.
- Name in a new `wp_` table: a migration for something only Kyla sees. Rejected.

## Design
- **Login page:** email + password form, "Sign in" button (`signInWithPassword`). Under it, a smaller
  "Email me a link instead" (the existing magic-link flow, unchanged). The link is also the forgot-password route:
  sign in by link, then set a new password on the account page.
- **Failure message:** wrong password, unknown user, or email not on `TEACHER_EMAILS` all show the same
  "That email and password didn't work." A non-allowlisted email is never sent to Supabase; if Supabase signs in a
  user who isn't on the list, sign them straight back out.
- **Account page `/teacher/account`** (behind `requireTeacher`, linked from the top bar):
  - Name: 1–60 characters after trimming, saved as `user_metadata.display_name` via `auth.updateUser({ data })`.
  - Password: new password twice, at least 8 characters, must match; saved via `auth.updateUser({ password })`.
    If the project requires a recent sign-in ("secure password change") or Supabase rejects the password
    (weak/too short for its own rules), show a clear message, e.g. "Sign in again with an email link, then try."
  - Each form saves on its own and shows a short "Saved" status.
- **Top bar:** "Hi, <name>" (falls back to the email) next to "Account" and "Sign out".
- **First time:** sign in with one more email link, then set a password on the account page.
- **Docs:** update `docs/teacher-login.md`.
- **Tests:** unit tests for validation and the neutral failure, component/e2e coverage of the login and account pages
  in line with the existing teacher tests.

## Left to the builder
- Exact copy beyond what is quoted above, layout within the existing teacher styles, how the account page reports
  per-form status (query params like the student rename page uses are fine).
