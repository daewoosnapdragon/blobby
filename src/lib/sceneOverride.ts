/**
 * Test-only scene override (e.g. `?scene-date=2026-12-24T12:00:00%2B09:00&scene-hour=22`) so screenshots and e2e
 * can fake the date and hour. Always null in production builds (NODE_ENV is inlined, so the rest is dead code there).
 */
export function sceneParam(name: 'scene-date' | 'scene-hour', search: string | string[] | undefined | URLSearchParams): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (search instanceof URLSearchParams) return search.get(name);
  const v = Array.isArray(search) ? search[0] : search;
  return v ?? null;
}

/** "Now" for the Seoul-date parts of the scene (server pages). */
export function sceneNow(sceneDate?: string | string[]): Date {
  const raw = sceneParam('scene-date', sceneDate);
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(+d) ? d : new Date();
}
