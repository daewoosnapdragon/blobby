/**
 * Sign-in answers wait at least this long, whatever the email. Without it, an email on TEACHER_EMAILS answers
 * slower (it waits on Supabase) than one that isn't, and timing the replies would reveal the allowed email.
 */
export const SIGNIN_MIN_MS = 1000;

/** Resolves once SIGNIN_MIN_MS have passed since `start` (a Date.now() value). */
export async function holdUntil(start: number): Promise<void> {
  const wait = start + SIGNIN_MIN_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}
