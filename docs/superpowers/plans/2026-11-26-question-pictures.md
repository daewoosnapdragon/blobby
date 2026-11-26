# Question Pictures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One optional Noto Color Emoji picture per question, chosen in the editor by suggestion or search, shown above the question on kid screens.

**Architecture:** Pictures are static SVGs under `public/pictures/` with a JSON catalog; questions store only the picture name; matching is pure functions in `src/lib/pictures.ts`.

**Tech Stack:** Next.js 15, zod, Vitest, Playwright; dev deps `@iconify-json/noto`, `emojibase-data`.

**Spec:** `docs/superpowers/specs/2026-11-26-question-pictures-design.md`

## Global Constraints
- Picture names match `^[a-z0-9-]{1,64}$`; validated in the schema, not against the catalog.
- No outside requests: images load from `/pictures/<name>.svg`.
- Pictures are decorative (`alt=""`); the question text carries the meaning.
- Watch-and-answer keeps no picture of its own (its inner questions may have one).

## Review Focus
1. A question saved before this change (no `picture`) → renders exactly as before, editor draft has `picture: ''` (Task 2 tests).
2. A typo'd or removed picture name in a payload → kid screen shows no broken image (Task 3: `onError` hides it; test).
3. Plural and irregular nouns in the question text ("mice", "children", "boxes", "berries") → suggestions find mouse, child, box, berry (Task 1 tests).
4. Very common words ("the", "is", "a") → never suggested (Task 1 test).
5. Search with mixed case/extra spaces ("  Taxi ") → finds the taxi (Task 1 test).

---

### Task 1: Picture set and matching
**Files:** Create `scripts/build-pictures.ts`, `public/pictures/*`, `src/lib/pictures.ts`; Test `tests/unit/pictures.test.ts`.
**Produces:** `type PictureEntry = { n: string; l: string; k: string[] }`; `singular(word: string): string`; `suggestPictures(text: string, catalog: PictureEntry[], n?: number): PictureEntry[]` (default 4); `searchPictures(query: string, catalog: PictureEntry[], n?: number): PictureEntry[]` (default 24); `pictureSrc(name: string): string` → `/pictures/<name>.svg`.
- [ ] Failing tests on a small fixture catalog: singular (mice→mouse, children→child, boxes→box, berries→berry, feet→foot, teeth→tooth, people→person, cats→cat, bus→bus, glass→glass); suggest from "Ben drew an elephant today." → elephant first; from "Three mice ran." → mouse; stop words never suggested; exact name match ranks above keyword match; search "  Taxi " finds taxi; search matches keywords ("car" → taxi via keyword); empty query → [].
- [ ] Implement; build script writes ~1,700 SVGs + catalog + license; commit output.

### Task 2: Schema and editor drafts
**Files:** Modify `src/lib/questions/schema.ts`, `src/lib/questions/draft.ts`; Test `tests/unit/questions.test.tsx` (or new `tests/unit/picturesSchema.test.ts`).
- [ ] Failing tests: `parseQuestion` keeps a valid `picture`; rejects `"../x"` and 65 chars; old payload without picture parses unchanged; `draftFromQuestion` → `picture` ('' when absent); `draftToPayload` includes `picture` only when non-empty; watch_answer inner questions keep theirs.
- [ ] Implement.

### Task 3: Kid screen and editor
**Files:** Create `src/components/questions/QuestionPicture.tsx`, `src/app/teacher/editor/PicturePicker.tsx`; Modify `QuestionPlayer.tsx`, `QuestionAnswers.tsx`, `QuestionForm.tsx` (+ the per-type forms as needed); Tests `tests/unit/questionPicture.test.tsx`.
- [ ] Failing tests: `QuestionPicture` renders `/pictures/elephant.svg` with `alt=""`, renders nothing for no name, hides itself on `error`; `PicturePicker` (catalog injected) shows suggestions for its text, search results for a typed keyword, choosing sets the hidden input and shows Remove; `QuestionAnswers` shows the picture thumbnail.
- [ ] Implement; run unit suite, tsc, e2e.

### Task 4: Pictures for the test week
**Files:** Modify `content/test-week-g*.json`; Create SQL (scratch, not committed) for the live questions.
- [ ] Add `picture` where a clear concrete noun exists and it doesn't give the answer away; `check-content` passes; SQL sets `payload = payload || {"picture": ...}` only where the live payload has no picture and its position matches.
