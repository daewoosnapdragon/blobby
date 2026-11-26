# Teacher login (one-time setup)

Kyla signs in to the teacher view with her email and password, through Supabase Auth. An emailed magic link
("Email me a link instead") still works, and is how she gets in the first time or after forgetting her password.

1. In the Supabase dashboard open **Authentication → URL configuration** and add
   `${APP_URL}/teacher/auth/callback` to **Redirect URLs** (for example
   `https://blobby.example.com/teacher/auth/callback`; add the `http://localhost:3000/...` one for local work).
2. Set these environment variables on the host:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the anon key, never the service role key)
   - `TEACHER_EMAILS`: comma-separated emails allowed in (case-insensitive), e.g. `kyla@school.org`
   - `APP_URL`: the app's public address, no trailing slash
3. Add Kyla once in Supabase **Authentication → Users → Add user** (her `TEACHER_EMAILS` address).
   Sign-in uses `shouldCreateUser: false`, so no one can be created by asking for a link.
   You can type a password for her here too; then she can sign in with it straight away.
4. First sign-in without a password: open `/teacher`, enter the email, press **Email me a link instead**, and open
   the link that arrives. It lands on `/teacher/auth/callback` and then on the classes page.
5. Open **Account** (top bar) and set a password (at least 8 characters, typed twice) and a name. The name shows
   as "Hi, <name>" in the top bar. From then on, sign in with email and password.

## Passwords and the account page

- Forgot the password? Use **Email me a link instead**, then set a new one on **Account**.
- If Supabase **Authentication → Providers → Email → Secure password change** is on, changing a password needs a
  recent sign-in. The account page then says to sign in again with an email link and try again.
- Supabase's own password rules (**Authentication → Providers → Email**, minimum length and required characters)
  apply on top of the app's 8-character minimum. A password they reject shows "too easy to guess".
- The sign-in email can't be changed in the app. It has to match `TEACHER_EMAILS`, so changing it is a settings
  job: update the user in Supabase and `TEACHER_EMAILS` together.
- The name is saved on the Supabase user (`user_metadata.display_name`); no table holds it.

Notes:
- Anyone not on `TEACHER_EMAILS` gets the same "check your email" message and no email is sent. Password sign-in
  answers "That email and password didn't work." for a wrong password and for an email not on the list alike, and
  never sends a non-listed email to Supabase. Both sign-in answers take at least one second whatever the email, so
  timing the replies does not reveal which email is allowed (`src/lib/evenTiming.ts`).
- Every teacher page and action re-checks the signed-in email against `TEACHER_EMAILS`; the middleware redirect is only a convenience.
- Magic links are single-use and open in the same browser that asked for them.
- In production `APP_URL` is required: without it no login email is sent (the page still answers neutrally),
  the callback answers 503, and the cards page shows an error instead of QR codes. Outside production the request host is used.

## QR cards

`/teacher/class/<id>/cards` prints 8 cards per A4 page (Print cards, scale 100%). `?student=<id>` prints one kid's card.
**Making a new card link** (student page) stops the old card working at once, but does **not** sign out devices that
already used it: their cookie stays valid. Reprint the new card from the link shown after reissuing.
