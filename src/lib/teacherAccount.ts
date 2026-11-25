/** Teacher account rules: name and password checks, and Supabase error mapping. Pure, no Next or Supabase imports. */

export const NAME_MAX = 60;
export const PASSWORD_MIN = 8;

/** The trimmed name, or null when it is blank or longer than NAME_MAX. */
export function validateName(raw: unknown): string | null {
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

export type PasswordProblem = 'short' | 'mismatch';

/** Passwords are never trimmed: every character counts. */
export function validatePassword(pw: unknown, confirm: unknown): PasswordProblem | null {
  const p = typeof pw === 'string' ? pw : '';
  if (p.length < PASSWORD_MIN) return 'short';
  return p === confirm ? null : 'mismatch';
}

export type PasswordError = 'reauth' | 'weak' | 'same' | 'failed';

const PASSWORD_ERRORS: Record<string, PasswordError> = {
  reauthentication_needed: 'reauth',
  weak_password: 'weak',
  same_password: 'same',
};

export function passwordError(err: { code?: string } | null | undefined): PasswordError {
  return (err?.code && PASSWORD_ERRORS[err.code]) || 'failed';
}

/** The name saved on the Supabase user, or null when none is set. */
export function teacherName(user: { user_metadata?: Record<string, unknown> } | null | undefined): string | null {
  const name = user?.user_metadata?.display_name;
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
}
