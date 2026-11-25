// Kid session cookie: "<studentId>.<base64url HMAC-SHA256(studentId)>". No passwords (spec §5.1).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'wp_student';
const MAX_AGE_SECONDS = 120 * 24 * 60 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

function mac(id: string): string {
  return createHmac('sha256', secret()).update(id).digest('base64url');
}

export function signStudent(id: string): string {
  return `${id}.${mac(id)}`;
}

/** Returns the student id if the cookie value is authentic, else null. */
export function verifyStudent(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [id, sig] = parts;
  const expected = Buffer.from(mac(id));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return id;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}
