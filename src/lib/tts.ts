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
    const client = new OpenAI(); // reads OPENAI_API_KEY
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

/** Maps every spoken string to its public URL, synthesizing only keys missing from storage. */
export async function ensureAudio(q: Question, deps: AudioDeps): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const text of spokenStrings(q)) {
    const key = audioKey(text, deps.voice);
    if (!(await deps.storage.exists(key))) await deps.storage.upload(key, await deps.synthesize(text));
    out[text] = deps.storage.publicUrl(key);
  }
  return out;
}
