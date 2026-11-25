'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeacher, teacherSupabase } from '@/lib/supabase/server';
import { isTeacherEmail } from '@/lib/teacherAuth';
import { publicOrigin } from '@/lib/teacherUrl';
import { setDisplayName, DISPLAY_NAME_MAX } from '@/lib/db/teacher';
import { UUID_RE } from '@/lib/uuid';

/** Same neutral outcome whether or not the email is allowed: no allowlist leak. */
export async function requestLink(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && isTeacherEmail(email)) {
    const supabase = await teacherSupabase();
    if (supabase) {
      const origin = await publicOrigin();
      // Errors are swallowed on purpose: the page answers the same either way.
      await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/teacher/auth/callback` } }).catch(() => undefined);
    }
  }
  redirect('/teacher/login?sent=1');
}

export async function signOut(): Promise<void> {
  const supabase = await teacherSupabase();
  await supabase?.auth.signOut();
  redirect('/teacher/login');
}

export async function renameStudent(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get('studentId') ?? '');
  const name = String(formData.get('name') ?? '');
  if (!UUID_RE.test(id)) redirect('/teacher');
  const ok = name.trim().length >= 1 && name.trim().length <= DISPLAY_NAME_MAX;
  if (ok) {
    await setDisplayName(id, name);
    revalidatePath(`/teacher/student/${id}`);
    revalidatePath('/teacher/class/[id]', 'page');
  }
  redirect(`/teacher/student/${id}${ok ? '' : '?name=bad'}`);
}
