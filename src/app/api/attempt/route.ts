import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UUID_RE } from '@/lib/uuid';
import { NotFoundError, recordAttempt, studentFromRequest } from '@/lib/db/kid';

export const dynamic = 'force-dynamic';

const Body = z.object({
  clientAttemptId: z.string().regex(UUID_RE),
  questionId: z.string().regex(UUID_RE),
  correct: z.boolean(),
  context: z.enum(['lesson', 'free']),
  runId: z.string().regex(UUID_RE).optional(),
});

export async function POST(req: Request) {
  const student = await studentFromRequest();
  if (!student) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    // studentId lets an open tab notice that the phone switched kids (Review Focus #2).
    return NextResponse.json({ ...(await recordAttempt(student.id, parsed.data)), studentId: student.id });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    throw e;
  }
}
