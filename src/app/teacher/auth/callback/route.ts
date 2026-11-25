import { NextResponse, type NextRequest } from 'next/server';
import { teacherSupabase } from '@/lib/supabase/server';
import { isTeacherEmail } from '@/lib/teacherAuth';
import { appOrigin } from '@/lib/teacherUrl';

export const dynamic = 'force-dynamic';

/** The magic link lands here with ?code=...; exchange it for a session, then send teachers to the classes page. */
export async function GET(req: NextRequest) {
  const origin = await appOrigin().catch(() => null);
  if (!origin) return new NextResponse('Sign-in is not set up yet.', { status: 503 });
  const fail = NextResponse.redirect(new URL('/teacher/login?error=link', origin));
  const code = req.nextUrl.searchParams.get('code');
  const supabase = await teacherSupabase();
  if (!code || !supabase) return fail;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail;
  const { data } = await supabase.auth.getUser();
  if (!isTeacherEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return fail;
  }
  return NextResponse.redirect(new URL('/teacher', origin));
}
