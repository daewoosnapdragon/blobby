'use server';
import { revalidatePath } from 'next/cache';
import { requireTeacher } from '@/lib/supabase/server';
import { countMissingAudio, fillMissingAudio } from '@/lib/db/teacher';

/** Strings per press: about 20 voice calls at 4 at a time, well inside one server function's time budget. */
const PER_CALL = 20;

/** Makes audio for the next ~20 missing sentences; the Plans page card calls this again until none remain. */
export async function makeMissingAudio(): Promise<{ done: number; remaining: number; error?: string }> {
  await requireTeacher();
  const result = await fillMissingAudio(PER_CALL);
  revalidatePath('/teacher/plans');
  return result;
}

export async function missingAudioCount(): Promise<number> {
  await requireTeacher();
  return countMissingAudio();
}
