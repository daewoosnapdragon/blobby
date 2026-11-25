import { NextResponse } from 'next/server';
import { ping, studentFromRequest } from '@/lib/db/kid';

export const dynamic = 'force-dynamic';

/** The practice screens call this every 30 seconds while a kid is really there. Counts practice time. */
export async function POST() {
  const student = await studentFromRequest();
  if (!student) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await ping(student.id);
  return new NextResponse(null, { status: 204 });
}
