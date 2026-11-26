'use server';
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireTeacher, teacherSupabase } from '@/lib/supabase/server';
import { isTeacherEmail } from '@/lib/teacherAuth';
import { appOrigin } from '@/lib/teacherUrl';
import { NotFoundError, landingPath } from '@/lib/db/kid';
import { SESSION_COOKIE, signStudent, sessionCookieOptions } from '@/lib/session';
import { studentDetail, setDisplayName, reissueLink, DISPLAY_NAME_MAX, practiceStudentFor, resetPracticeStudent } from '@/lib/db/teacher';
import { UUID_RE } from '@/lib/uuid';
import { passwordError, validateName, validatePassword } from '@/lib/teacherAccount';
import { holdUntil } from '@/lib/evenTiming';

/** Same neutral outcome whether or not the email is allowed: no allowlist leak. */
export async function requestLink(formData: FormData): Promise<void> {
  const start = Date.now();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && isTeacherEmail(email)) {
    const supabase = await teacherSupabase();
    if (supabase) {
      // Missing APP_URL in production and Supabase errors are swallowed on purpose: the page answers the same either way.
      const origin = await appOrigin().catch(() => null);
      if (origin) {
        // shouldCreateUser:false: only users Kyla added in Supabase Auth can ever get a link.
        await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/teacher/auth/callback` } }).catch(() => undefined);
      }
    }
  }
  await holdUntil(start);
  redirect('/teacher/login?sent=1');
}

/** Wrong password, unknown user, and an email not on TEACHER_EMAILS all end on the same neutral error. */
export async function signInWithPassword(formData: FormData): Promise<void> {
  const start = Date.now();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  let ok = false;
  // The allowlist is checked first, so an email that isn't on it is never sent to Supabase.
  if (password !== '' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && isTeacherEmail(email)) {
    const supabase = await teacherSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        ok = !error && isTeacherEmail(data.user?.email);
        if (!error && !ok) await supabase.auth.signOut();
      } catch {
        ok = false;
      }
    }
  }
  await holdUntil(start);
  redirect(ok ? '/teacher' : '/teacher/login?error=signin');
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
    try { await setDisplayName(id, name); } catch (e) { if (e instanceof NotFoundError) notFound(); throw e; }
    revalidatePath(`/teacher/student/${id}`);
    revalidatePath('/teacher/class/[id]', 'page');
  }
  redirect(`/teacher/student/${id}${ok ? '' : '?name=bad'}`);
}

/** After this the old card stops working; the new link is only ever printed, never shown. Devices already signed in stay signed in. */
export async function reissueStudentLink(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get('studentId') ?? '');
  if (!UUID_RE.test(id)) redirect('/teacher');
  let classId: string;
  try {
    await reissueLink(id);
    const d = await studentDetail(id);
    if (!d) notFound();
    classId = d.classId;
  } catch (e) { if (e instanceof NotFoundError) notFound(); throw e; }
  revalidatePath(`/teacher/class/${classId}/cards`);
  redirect(`/teacher/student/${id}?reissued=1`);
}

/** The name shows only in the teacher top bar. Saved on the Supabase user, so no table is needed. */
export async function saveTeacherName(formData: FormData): Promise<void> {
  await requireTeacher();
  const name = validateName(formData.get('name'));
  if (!name) redirect('/teacher/account?error=name');
  const supabase = await teacherSupabase();
  const result = await supabase?.auth.updateUser({ data: { display_name: name } }).catch(() => null);
  if (!result || result.error) redirect('/teacher/account?error=failed');
  revalidatePath('/teacher', 'layout');
  redirect('/teacher/account?saved=name');
}

/** Also how a first password is set: sign in once with an email link, then save one here. */
export async function changePassword(formData: FormData): Promise<void> {
  await requireTeacher();
  const password = formData.get('password');
  const problem = validatePassword(password, formData.get('confirm'));
  if (problem) redirect(`/teacher/account?error=${problem}`);
  const supabase = await teacherSupabase();
  const result = await supabase?.auth.updateUser({ password: String(password) }).catch(() => null);
  if (!result) redirect('/teacher/account?error=failed');
  if (result.error) redirect(`/teacher/account?error=${passwordError(result.error)}`);
  redirect('/teacher/account?saved=password');
}

/** Signs this browser into the kid screens as the class's hidden practice student (the teacher session is untouched). */
export async function tryAsStudent(formData: FormData): Promise<void> {
  await requireTeacher();
  const classId = String(formData.get('classId') ?? '');
  if (!UUID_RE.test(classId)) redirect('/teacher');
  let student;
  try { student = await practiceStudentFor(classId); } catch (e) { if (e instanceof NotFoundError) notFound(); throw e; }
  (await cookies()).set(SESSION_COOKIE, signStudent(student.id), sessionCookieOptions());
  redirect(landingPath(student));
}

/** Gives the practice student a fresh start: no stars, answers, finished lessons, stamps or blob color. */
export async function resetPracticeStudentAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const classId = String(formData.get('classId') ?? '');
  if (!UUID_RE.test(classId)) redirect('/teacher');
  await resetPracticeStudent(classId);
  revalidatePath(`/teacher/class/${classId}`);
  redirect(`/teacher/class/${classId}?reset=1`);
}
