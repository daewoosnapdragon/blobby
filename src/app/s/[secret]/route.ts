import { NextResponse, type NextRequest } from 'next/server';
import { studentBySecret, landingPath } from '@/lib/db/kid';
import { SESSION_COOKIE, signStudent, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  const student = await studentBySecret(secret);
  if (!student) return NextResponse.redirect(new URL('/link-problem', req.url));
  const res = NextResponse.redirect(new URL(landingPath(student), req.url));
  res.cookies.set(SESSION_COOKIE, signStudent(student.id), sessionCookieOptions());
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
