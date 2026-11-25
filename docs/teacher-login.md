# Teacher login (one-time setup)

Kyla signs in to the teacher view with an emailed magic link, through Supabase Auth.

1. In the Supabase dashboard open **Authentication → URL configuration** and add
   `${APP_URL}/teacher/auth/callback` to **Redirect URLs** (for example
   `https://blobby.example.com/teacher/auth/callback`; add the `http://localhost:3000/...` one for local work).
2. Set these environment variables on the host:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the anon key, never the service role key)
   - `TEACHER_EMAILS`: comma-separated emails allowed in (case-insensitive), e.g. `kyla@school.org`
   - `APP_URL`: the app's public address, no trailing slash
3. Open `/teacher`. Enter the email, then open the link that arrives. It lands on `/teacher/auth/callback` and
   then on the classes page.

Notes:
- Anyone not on `TEACHER_EMAILS` gets the same "check your email" message and no email is sent.
- Every teacher page and action re-checks the signed-in email against `TEACHER_EMAILS`; the middleware redirect is only a convenience.
- Magic links are single-use and open in the same browser that asked for them.
