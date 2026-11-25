// Pre-generated read-aloud audio (spec 5.7). Server/scripts only (node:crypto).
// Voice service sits behind a tiny provider interface so a swap is a one-file change (see docs/audio.md).
import { createHash } from 'node:crypto';
import type { Question } from './questions/schema';
import { spokenStrings } from './spoken';
import { getAudioStorage, type AudioStorage } from './audio-storage';

export { spokenStrings };
export type { AudioStorage };

export interface TtsProvider {
  synthesize(text: string, opts: { voice: string; model: string }): Promise<Buffer>;
}

const openaiProvider: TtsProvider = {
  async synthesize(text, { voice, model }) {
    const { default: OpenAI } = await import('openai');
    // reads OPENAI_API_KEY. Short timeout and one retry: the SDK default (10 minutes, 2 retries) would hang an editor save.
    const client = new OpenAI({ timeout: 15_000, maxRetries: 1 });
    const res = await client.audio.speech.create({ model, voice, input: text, response_format: 'mp3' });
    return Buffer.from(await res.arrayBuffer());
  },
};

const providers: Record<string, TtsProvider> = { openai: openaiProvider };

export const ttsVoice = () => process.env.TTS_VOICE || 'nova';
const ttsModel = () => process.env.TTS_MODEL || 'tts-1';

export function audioKey(text: string, voice: string): string {
  return createHash('sha256').update(`${voice}\n${text}`).digest('hex');
}

export async function synthesize(text: string): Promise<Buffer> {
  const name = process.env.TTS_PROVIDER || 'openai';
  const p = providers[name];
  if (!p) throw new Error(`Unknown TTS_PROVIDER "${name}"`);
  return p.synthesize(text, { voice: ttsVoice(), model: ttsModel() });
}

export interface AudioDeps {
  storage: AudioStorage;
  synthesize: (text: string) => Promise<Buffer>;
  voice: string;
}

export async function defaultAudioDeps(): Promise<AudioDeps> {
  return { storage: await getAudioStorage(), synthesize, voice: ttsVoice() };
}

export interface EnsureOptions {
  /** overall deadline in ms: past it, ensureAudio rejects with AudioTimeoutError and starts no new work (the editor uses this) */
  timeoutMs?: number;
  /** strings handled at once (default 4) */
  concurrency?: number;
}

export class AudioTimeoutError extends Error {
  constructor() { super('Audio took too long'); }
}

/** Maps every spoken string to its public URL, synthesizing only keys missing from storage, a few at a time. */
export async function ensureAudio(q: Question, deps: AudioDeps, opts: EnsureOptions = {}): Promise<Record<string, string>> {
  const texts = spokenStrings(q);
  const urls = new Map<string, string>();
  let stopped = false;
  let next = 0;
  async function worker() {
    while (!stopped && next < texts.length) {
      const text = texts[next++];
      const key = audioKey(text, deps.voice);
      if (!(await deps.storage.exists(key))) await deps.storage.upload(key, await deps.synthesize(text));
      urls.set(text, deps.storage.publicUrl(key));
    }
  }
  const run = Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, texts.length) }, worker)).then(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await (opts.timeoutMs === undefined ? run : Promise.race([
      run,
      new Promise<never>((_, reject) => { timer = setTimeout(() => { stopped = true; reject(new AudioTimeoutError()); }, opts.timeoutMs); }),
    ]));
  } catch (e) {
    stopped = true;
    run.catch(() => undefined); // a late failure after the deadline is not an unhandled rejection
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  return Object.fromEntries(texts.map((t) => [t, urls.get(t)!]));
}
