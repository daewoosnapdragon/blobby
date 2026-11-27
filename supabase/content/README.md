# Loading the Nov 26 content pass

Kyla, these eight files put this content pass into the app: the new names, the new prompts, the silly
rewrites, and the new questions (Q13 to Q15 in every test-week lesson, Q11 in every review-bank skill).
You paste them into the Supabase SQL editor. No terminal needed.

The list of everything that changed, to read before you load, is `content/review/2026-11-26-content-pass.md`.

## What each file does

| File | Changes | Adds |
| --- | --- | --- |
| `2026-11-26-test-week-g1.sql` | 42 questions | 15 questions |
| `2026-11-26-test-week-g2.sql` | 40 questions | 15 questions |
| `2026-11-26-test-week-g3.sql` | 43 questions | 15 questions |
| `2026-11-26-test-week-g4.sql` | 40 questions | 15 questions |
| `2026-11-26-review-bank-g1.sql` | 65 questions | 10 questions |
| `2026-11-26-review-bank-g2.sql` | 73 questions | 10 questions |
| `2026-11-26-review-bank-g3.sql` | 60 questions | 9 questions |
| `2026-11-26-review-bank-g4.sql` | 75 questions | 10 questions |

That is 438 changed and 99 new in all. A changed question keeps its place in the app, so kids' answers and
stars stay with it. The rest of the questions are not touched.

## Steps

1. **Deploy the app first.** The Plans page needs its "Read-aloud audio" card for step 3.
2. **Load the files one at a time,** in any order. For each file:
   1. Open the file and copy **PART 1**: from the top down to the line that says `STOP`.
   2. Paste it into the SQL editor and run it. It only reads; it changes nothing.
   3. Read the list. Any question you edited in the app shows up here. Note it: PART 2 replaces it with
      the file's version, and you can make your edit again in the app afterwards. No rows means nothing of
      yours is replaced.
   4. Copy **PART 2**: from the line `>>> PART 2 STARTS HERE <<<` to the end of the file.
   5. Paste it into the SQL editor and run it. It says "Success. No rows returned" when it worked.
3. **Make the audio.** When all eight files are done, open Plans → Read-aloud audio and press
   **Make missing audio**. It makes 20 sentences at a time and keeps going on its own. Leave the page open
   until it says "All sentences have audio". If it stops with an error, wait a minute and press it again;
   what it already made is saved.
4. **Kids wait until then.** Kids should not open the changed lessons until the card says "All sentences have
   audio". Until then, "Hear it" shows "Try again" on the new and changed sentences.

Running a file twice is safe: the second run changes nothing. Questions you deleted in the app stay deleted.

## For the developer

Each file was made with
`npx tsx scripts/content-to-sql.ts supabase/content/2026-11-26-<name>.sql --update --base git:main content/<name>.json`.
`--base git:main` means "the content as it was before this pass": PART 1 lists the questions whose text in the
app is not that version, so only Kyla's own edits show up.
