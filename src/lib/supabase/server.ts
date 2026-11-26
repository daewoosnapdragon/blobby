import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { isTeacherEmail } from '../teacherAuth';
import { teacherName } from '../teacherAccount';

/** Supabase Auth client bound to the request's cookies (anon key; teacher sign-in only). Null when not configured. */
export async function teacherSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        // Server components can't set cookies; middleware and actions/route handlers can. Ignore the former.
        try { for (const { name, value, options } of list) jar.set(name, value, options); } catch { /* read-only context */ }
      },
    },
  });
}

/**
 * The signed-in teacher's email and saved name, or redirects to the login page. Re-checks the allowlist on every
 * call: middleware is a convenience, this is the gate. getUser() asks Supabase to validate the session token.
 */
export async function requireTeacherUser(): Promise<{ email: string; name: string | null }> {
  const supabase = await teacherSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (isTeacherEmail(email)) return { email: email!.trim().toLowerCase(), name: teacherName(data.user) };
  }
  redirect('/teacher/login');
}

/** The signed-in teacher's email, or redirects to the login page. */
export async function requireTeacher(): Promise<string> {
  return (await requireTeacherUser()).email;
}
