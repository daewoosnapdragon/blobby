import 'server-only';
import { cookies } from 'next/headers';
import { sql } from './admin';
import { SESSION_COOKIE, verifyStudent } from '../session';
import { UUID_RE } from '../uuid';
import type { WpStudent } from '../types';


export async function studentById(id: string): Promise<WpStudent | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await sql<WpStudent[]>`select * from wp_students where id = ${id}`;
  return row ?? null;
}

export async function studentBySecret(secret: string): Promise<WpStudent | null> {
  if (!secret || secret.length > 200) return null;
  const [row] = await sql<WpStudent[]>`select * from wp_students where link_secret = ${secret}`;
  return row ?? null;
}

export interface JoinNames {
  classId: string;
  names: { id: string; displayName: string; blobColor: string | null }[];
}

/** Class code (any case) -> the class's kids, or null for an unknown code. */
export async function classByCode(code: string): Promise<JoinNames | null> {
  const [cls] = await sql<{ id: string }[]>`select id from wp_classes where class_code = ${code.trim().toUpperCase()}`;
  if (!cls) return null;
  const rows = await sql<{ id: string; display_name: string; blob_color: string | null }[]>`
    select id, display_name, blob_color from wp_students where class_id = ${cls.id} order by display_name`;
  return {
    classId: cls.id,
    names: rows.map((r) => ({ id: r.id, displayName: r.display_name, blobColor: r.blob_color })),
  };
}

/** The student, only if they belong to the class with this code. */
export async function studentForJoin(code: string, studentId: string): Promise<WpStudent | null> {
  if (!UUID_RE.test(studentId)) return null;
  const [row] = await sql<WpStudent[]>`
    select s.* from wp_students s join wp_classes c on c.id = s.class_id
    where s.id = ${studentId} and c.class_code = ${code.trim().toUpperCase()}`;
  return row ?? null;
}

/**
 * The signed-in kid, read from the cookie on every call. Deliberately uncached: a kid can switch
 * (or be switched) between any two requests, and every kid route must see the current one.
 */
export async function studentFromRequest(): Promise<WpStudent | null> {
  const jar = await cookies();
  const id = verifyStudent(jar.get(SESSION_COOKIE)?.value);
  return id ? studentById(id) : null;
}

/** Where a kid goes after signing in. */
export function landingPath(s: Pick<WpStudent, 'blob_color'>): '/pick' | '/' {
  return s.blob_color ? '/' : '/pick';
}
