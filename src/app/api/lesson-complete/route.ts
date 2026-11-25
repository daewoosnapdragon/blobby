import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UUID_RE } from '@/lib/uuid';
import { NotFoundError, completeLesson, studentFromRequest } from '@/lib/db/kid';

export const dynamic = 'force-dynamic';

const Body = z.object({ lessonId: z.string().regex(UUID_RE) });

export async function POST(req: Request) {
  const student = await studentFromRequest();
  if (!student) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    return NextResponse.json(await completeLesson(student.id, parsed.data.lessonId));
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    throw e;
  }
}
