import 'server-only';
import { headers } from 'next/headers';

export class MissingAppUrlError extends Error {
  constructor() { super('APP_URL is not set. Set it to the app\'s public address (no trailing slash).'); this.name = 'MissingAppUrlError'; }
}

/**
 * The app's public origin, used for auth redirects and QR codes. In production APP_URL is required
 * (fails closed: a Host header must never decide where a magic link or a printed card points).
 * Outside production, falls back to this request's own host.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') throw new MissingAppUrlError();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
