# Read-aloud audio

## Switched off for now

Read-aloud is off: `READ_ALOUD = false` in `src/lib/features.ts`. While it is off:
- Kids see no "Hear it" button, and Grades 1–2 get no auto-reading.
- The editor doesn't offer "Listen and tap" for new questions (it only works with audio). An existing one can still be edited.
- Saving a question and running the importer make no audio, so no `OPENAI_API_KEY` (or other voice key) is needed.
- Sound effects (pop, ding, boop, squeak) are unaffected: they are local files in `public/sounds/`.

To turn it back on: set `READ_ALOUD = true`, add the voice service key, then run the importer once to make audio for
every question (see below). Before that, pick a voice service that isn't shutting down (see Shutdown, below).

Audio is pre-generated (spec 5.7) as mp3 files in the public Storage bucket `wp-audio`, at `audio/{key}.mp3`, where `key = sha256(voice + "\n" + text)`. Each question's `audio` column maps every spoken string to its URL. Re-importing only synthesizes strings whose key is missing.

## Voice service
- OpenAI TTS, `tts-1` model, voice `nova` (warm American English). Override with `TTS_MODEL` and `TTS_VOICE`; needs `OPENAI_API_KEY`.
- Pricing (OpenAI model page): `tts-1` is $15 per 1M characters. About 600 questions is roughly 120k characters, about $2.
- **Shutdown:** OpenAI lists its TTS models for shutdown on Jan 6, 2027. The voice service sits behind a small provider interface in `src/lib/tts.ts`, chosen by `TTS_PROVIDER` (default `openai`). Swapping providers is a one-file change. Already-stored audio stays valid because URLs are keyed by text and voice, not by provider.

## Running the importer
```
DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
  npx tsx scripts/import-content.ts content/test-plan.json [--dry-run] [--no-audio]
```
`--dry-run` validates and prints counts only. `--no-audio` writes the DB and skips audio. The bucket is created (public read) if missing.
