# Question pictures: design

**Why:** a picture of the key noun ("Ben drew an elephant today" → elephant) helps kids, especially early readers,
know what a sentence is about. Kyla wants to pick pictures by keyword, with suggestions from the question's words.

**Approved:** Nov 26, 2026 (in conversation). Style: Noto Color Emoji (Google, Apache 2.0).

## Goals
- Any non-video question may carry one optional `picture` (a picture name, e.g. `elephant`).
- Kid screens show it large above the question. Questions without one look as before.
- The editor shows it on each question card, and the form has a **Picture** box: suggestions from the question's
  words (plurals and common irregulars matched), a keyword search (picture names plus Unicode CLDR keywords), and
  Remove.
- About 1,700 everyday pictures ship inside the app (no flags, no skin-tone variants, no keycaps).
- A picture never gives the answer away (content rule for whoever adds them).
- Claude adds pictures to the test-week questions with a clear concrete noun; Kyla reviews them in the editor.

## Non-goals
- Pictures on each choice or tile; scene illustrations; uploading her own images.

## Approaches
- **Pictures shipped in the app (picked):** same look on every device, no outside requests from kid screens.
- Loading from an image site while searching: depends on another site; rejected.

## Design
- `scripts/build-pictures.ts` (dev only) reads `@iconify-json/noto` and `emojibase-data`, writes
  `public/pictures/<name>.svg`, `public/pictures/catalog.json` (`[{ n, l, k }]`: name, label, keywords) and the
  Apache 2.0 notice. Output is committed.
- Schema: `picture?: string` (`^[a-z0-9-]{1,64}$`) on every non-video payload. An unknown name just shows nothing.
- `src/lib/pictures.ts` (pure): `singular(word)`, `suggestPictures(text, catalog, n)`, `searchPictures(query, catalog, n)`.
- Editor: drafts carry `picture`; `PicturePicker` (client) fetches the catalog once, suggests from the draft's text.
- Kid screen: `QuestionPlayer` renders the picture above the question body (decorative: `alt=""`).
- Content: test-week JSON gains `picture` fields; a SQL file adds them to the live questions without overwriting edits.
