'use server';
import { requireTeacher } from '@/lib/supabase/server';
import { fillMissingAudio } from '@/lib/db/teacher';

/**
 * Strings per press. Each row has its own 25 s limit and no new row starts after 30 s, so the worst case is
 * 30 + 25 = 55 s, inside the Plans page's 60 s maxDuration (this action runs under that page's route config).
 */
const PER_CALL = 20;

/** Makes audio for the next ~20 missing sentences; the Plans page card calls this again until none remain. */
export async function makeMissingAudio(): Promise<{ done: number; remaining: number; error?: string }> {
  await requireTeacher();
  return fillMissingAudio(PER_CALL);
}
