import { NextResponse } from 'next/server';
import { JoinBody } from '@/lib/joinBody';
import { classByCode, studentForJoin, landingPath } from '@/lib/db/kid';
import { SESSION_COOKIE, signStudent, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = JoinBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { code, studentId } = parsed.data;

  if (!studentId) {
    const found = await classByCode(code);
    if (!found) return NextResponse.json({ error: 'unknown_code' }, { status: 404 });
    return NextResponse.json(found);
  }

  const student = await studentForJoin(code, studentId);
  if (!student) return NextResponse.json({ error: 'not_in_class' }, { status: 404 });
  const res = NextResponse.json({ next: landingPath(student) });
  res.cookies.set(SESSION_COOKIE, signStudent(student.id), sessionCookieOptions());
  return res;
}
