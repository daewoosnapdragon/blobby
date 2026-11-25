/** Teacher allowlist helpers. Pure, so middleware (edge) and server code share them. */

export function parseTeacherEmails(list: string | undefined): string[] {
  return (list ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** True only for an email on the allowlist (comma-separated, trimmed, case-insensitive). An empty list admits nobody. */
export function isTeacherEmail(email: string | null | undefined, list: string | undefined = process.env.TEACHER_EMAILS): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return e !== '' && parseTeacherEmails(list).includes(e);
}
