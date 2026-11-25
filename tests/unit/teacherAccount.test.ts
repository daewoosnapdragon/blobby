import { describe, expect, it } from 'vitest';
import { NAME_MAX, PASSWORD_MIN, passwordError, teacherName, validateName, validatePassword } from '@/lib/teacherAccount';

describe('validateName', () => {
  it('trims and keeps a normal name', () => expect(validateName('  Kyla  ')).toBe('Kyla'));
  it('rejects blank and missing names', () => {
    expect(validateName('   ')).toBeNull();
    expect(validateName(undefined)).toBeNull();
  });
  it('allows exactly 60 characters and rejects 61', () => {
    expect(NAME_MAX).toBe(60);
    expect(validateName('a'.repeat(60))).toHaveLength(60);
    expect(validateName('a'.repeat(61))).toBeNull();
  });
});

describe('validatePassword', () => {
  it('needs at least 8 characters', () => {
    expect(PASSWORD_MIN).toBe(8);
    expect(validatePassword('1234567', '1234567')).toBe('short');
    expect(validatePassword(undefined, undefined)).toBe('short');
  });
  it('needs both copies to match', () => expect(validatePassword('12345678', '12345679')).toBe('mismatch'));
  it('accepts a matching long-enough password', () => expect(validatePassword('12345678', '12345678')).toBeNull());
  it('does not trim passwords: spaces count', () => expect(validatePassword('  abcd  ', '  abcd  ')).toBeNull());
});

describe('passwordError', () => {
  it('maps the Supabase codes Kyla can act on', () => {
    expect(passwordError({ code: 'reauthentication_needed' })).toBe('reauth');
    expect(passwordError({ code: 'weak_password' })).toBe('weak');
    expect(passwordError({ code: 'same_password' })).toBe('same');
  });
  it('treats anything else as a plain failure', () => {
    expect(passwordError({})).toBe('failed');
    expect(passwordError(null)).toBe('failed');
  });
});

describe('teacherName', () => {
  it('reads a trimmed display_name', () => expect(teacherName({ user_metadata: { display_name: ' Kyla ' } })).toBe('Kyla'));
  it('is null for empty, non-string, or missing names', () => {
    expect(teacherName({ user_metadata: { display_name: '' } })).toBeNull();
    expect(teacherName({ user_metadata: { display_name: 5 } })).toBeNull();
    expect(teacherName({})).toBeNull();
    expect(teacherName(null)).toBeNull();
  });
});
