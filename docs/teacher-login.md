# Teacher login (one-time setup)

Kyla signs in to the teacher view with an emailed magic link, through Supabase Auth.

1. In the Supabase dashboard open **Authentication → URL configuration** and add
   `${APP_URL}/teacher/auth/callback` to **Redirect URLs** (for example
   `https://blobby.example.com/teacher/auth/callback`; add the `http://localhost:3000/...` one for local work).
2. Set these environment variables on the host:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the anon key, never the service role key)
   - `TEACHER_EMAILS`: comma-separated emails allowed in (case-insensitive), e.g. `kyla@school.org`
   - `APP_URL`: the app's public address, no trailing slash
3. Add Kyla once in Supabase **Authentication → Users → Add user** (her `TEACHER_EMAILS` address).
   Sign-in uses `shouldCreateUser: false`, so no one can be created by asking for a link.
4. Open `/teacher`. Enter the email, then open the link that arrives. It lands on `/teacher/auth/callback` and
   then on the classes page.

Notes:
- Anyone not on `TEACHER_EMAILS` gets the same "check your email" message and no email is sent.
- Every teacher page and action re-checks the signed-in email against `TEACHER_EMAILS`; the middleware redirect is only a convenience.
- Magic links are single-use and open in the same browser that asked for them.
- In production `APP_URL` is required: without it no login email is sent (the page still answers neutrally),
  the callback answers 503, and the cards page shows an error instead of QR codes. Outside production the request host is used.

## QR cards

`/teacher/class/<id>/cards` prints 8 cards per A4 page (Print cards, scale 100%). `?student=<id>` prints one kid's card.
**Making a new card link** (student page) stops the old card working at once, but does **not** sign out devices that
already used it: their cookie stays valid. Reprint the new card from the link shown after reissuing.
