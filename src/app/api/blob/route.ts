import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BLOB_COLOR_KEYS } from '@/lib/blobColors';
import { setBlobColor, studentFromRequest } from '@/lib/db/kid';

export const dynamic = 'force-dynamic';

const Body = z.object({ color: z.enum(BLOB_COLOR_KEYS) });

export async function POST(req: Request) {
  const student = await studentFromRequest();
  if (!student) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  await setBlobColor(student.id, parsed.data.color);
  return NextResponse.json({ ok: true, color: parsed.data.color });
}
