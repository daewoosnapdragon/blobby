# Deploying Blobby

Blobby runs on Vercel and talks to the `wp_` tables in the shared Supabase project. This page lists the settings
it needs and the order to load content in. See also `docs/teacher-login.md`, `docs/audio.md` and
`docs/reset-test-stars.md`.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | What to put there |
| --- | --- |
| `DATABASE_URL` | The Supabase **shared transaction pooler** string (Supabase → Connect → Transaction pooler), port **6543**: `postgres://postgres.<project-ref>:<password>@<…>.pooler.supabase.com:6543/postgres`. The user is `postgres.<project-ref>`, not plain `postgres`. SSL is turned on by the app itself (`ssl: 'require'` in production), so the string needs no `sslmode`. |
| `SESSION_SECRET` | 32 or more random characters (for example the output of `openssl rand -base64 32`). It signs the kids' sign-in cookies; changing it signs every kid out. |
| `APP_URL` | The app's public address, no trailing slash, e.g. `https://blobby.example.com`. Used for QR cards and the teacher sign-in link. Required in production. |
| `SUPABASE_URL` | The project URL, `https://<project-ref>.supabase.co`. |
| `SUPABASE_ANON_KEY` | The anon (public) key. Used only for teacher sign-in. |
| `SUPABASE_SERVICE_ROLE_KEY` | The service role key. Server only; used for the audio Storage bucket. Never expose it to the browser. |
| `TEACHER_EMAILS` | Comma-separated emails allowed into `/teacher`. |
| `OPENAI_API_KEY` | For read-aloud audio when the editor saves a question (and for the content importer). |
| `TTS_MODEL`, `TTS_VOICE` | Optional. Default `tts-1` and `nova`. |

The scripts in `scripts/` read the same variables from the shell. They also use SSL for any database host
that isn't `localhost`.

## Region

Put the Vercel functions next to the database: **Vercel → Settings → Functions → Function Region** should be
the same region as the Supabase project (the Supabase project settings show it, e.g. Seoul, `ap-northeast-2`).
Every page makes several database calls, so a far-away region makes every screen slow.

## Loading content, in order

1. Roster: `npx tsx scripts/import-roster.ts <roster.csv>` (prints counts only).
2. Test plan, before the in-class test weeks: `npx tsx scripts/import-content.ts content/<test-plan>.json`.
3. The two test weeks run (spec §10).
4. Reset the test stars (`docs/reset-test-stars.md`). This also takes the test plan off every kid's home.
5. Winter plan: `npx tsx scripts/import-content.ts content/<winter-plan>.json`.

Importing the winter plan **early** (during the test weeks) is also safe: home shows the newest assigned plan
that has an open week that isn't done yet, so kids keep seeing the test plan until its weeks are done and the
first winter week opens.

Re-importing a file keeps what the teacher changed in the app (week skills and dates, lesson titles, edited
and deleted questions) and prints what it kept. Add `--overwrite` only when the file should replace those edits.

## Read-aloud voice: shutdown date

OpenAI lists its TTS models for shutdown on **Jan 6, 2027**. Audio already made stays in Storage and keeps
working; only new audio (editor saves, new imports) needs a voice service after that date. Swapping providers is
a one-file change in `src/lib/tts.ts` (see `docs/audio.md`).
