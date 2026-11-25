// Storage adapter for pre-generated audio. No server-only import: scripts run this under tsx.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const AUDIO_BUCKET = 'wp-audio';

export interface AudioStorage {
  exists(key: string): Promise<boolean>;
  upload(key: string, mp3: Buffer): Promise<void>;
  publicUrl(key: string): string;
}

const path = (key: string) => `audio/${key}.mp3`;

export function createAudioStorage(client: SupabaseClient): AudioStorage {
  const bucket = () => client.storage.from(AUDIO_BUCKET);
  return {
    async exists(key) {
      const { data, error } = await bucket().list('audio', { search: `${key}.mp3`, limit: 1 });
      if (error) throw new Error(`Storage list failed: ${error.message}`);
      return (data ?? []).some((f) => f.name === `${key}.mp3`);
    },
    async upload(key, mp3) {
      const { error } = await bucket().upload(path(key), mp3, { contentType: 'audio/mpeg', upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    publicUrl: (key) => bucket().getPublicUrl(path(key)).data.publicUrl,
  };
}

/** Service-role Storage client from env (scripts and server). Creates the public bucket if missing. */
export async function getAudioStorage(): Promise<AudioStorage> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.storage.getBucket(AUDIO_BUCKET);
  if (error) {
    const { error: e2 } = await client.storage.createBucket(AUDIO_BUCKET, { public: true });
    if (e2 && !/already exists/i.test(e2.message)) throw new Error(`Could not create bucket ${AUDIO_BUCKET}: ${e2.message}`);
  }
  return createAudioStorage(client);
}
