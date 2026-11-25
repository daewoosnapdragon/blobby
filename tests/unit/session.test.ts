import { describe, it, expect, beforeEach } from 'vitest';
import { signStudent, verifyStudent, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

const ID = '3f2b8c1e-0000-4000-8000-000000000001';

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-one';
});

describe('session cookie', () => {
  it('round-trips', () => {
    expect(verifyStudent(signStudent(ID))).toBe(ID);
  });
  it('rejects a tampered id', () => {
    const sig = signStudent(ID).split('.')[1];
    expect(verifyStudent(`3f2b8c1e-0000-4000-8000-000000000002.${sig}`)).toBeNull();
  });
  it('rejects a tampered signature', () => {
    const c = signStudent(ID);
    expect(verifyStudent(c.slice(0, -2) + (c.endsWith('AA') ? 'BB' : 'AA'))).toBeNull();
  });
  it('rejects a cookie signed with a different secret', () => {
    const c = signStudent(ID);
    process.env.SESSION_SECRET = 'another-secret';
    expect(verifyStudent(c)).toBeNull();
  });
  it('rejects missing, empty and malformed values', () => {
    expect(verifyStudent(undefined)).toBeNull();
    expect(verifyStudent('')).toBeNull();
    expect(verifyStudent('nodot')).toBeNull();
    expect(verifyStudent('a.b.c')).toBeNull();
  });
  it('throws if SESSION_SECRET is missing', () => {
    delete process.env.SESSION_SECRET;
    expect(() => signStudent(ID)).toThrow();
  });
  it('cookie options', () => {
    const o = sessionCookieOptions();
    expect(SESSION_COOKIE).toBe('wp_student');
    expect(o).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 120 * 24 * 60 * 60 });
  });
});
