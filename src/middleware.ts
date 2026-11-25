import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isTeacherEmail } from '@/lib/teacherAuth';

/** Teacher routes only. Kid routes use the wp_student cookie and are never touched here. */
export const config = { matcher: ['/teacher/:path*'] };

const PUBLIC = ['/teacher/login', '/teacher/auth/callback'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let res = NextResponse.next({ request: req });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  let email: string | undefined;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of list) res.cookies.set(name, value, options);
        },
      },
    });
    // Refreshes an expiring session as a side effect (setAll above).
    email = (await supabase.auth.getUser()).data.user?.email ?? undefined;
  }

  if (PUBLIC.includes(pathname) || isTeacherEmail(email)) return res;
  const login = req.nextUrl.clone();
  login.pathname = '/teacher/login';
  login.search = '';
  return NextResponse.redirect(login);
}
