// Shared postgres driver options (no server-only: also used by the integration test helper and scripts).
// date (oid 1082) stays a 'YYYY-MM-DD' string so Asia/Seoul date logic is never shifted by JS Date.
// pgOptions itself never sets ssl: local test databases run without it.
export const pgOptions = {
  prepare: false,
  types: {
    date: { to: 1082, from: [1082], serialize: (x: unknown) => x as string, parse: (x: string) => x },
  },
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * SSL for a database URL: always in production, and for any host that isn't this machine. Only a local
 * database (tests, dev) goes without. 'require' encrypts without checking the certificate chain, which is
 * what the Supabase pooler supports out of the box. A URL that can't be parsed fails safe (SSL on).
 */
export function dbSsl(url: string, opts: { production?: boolean } = {}): 'require' | false {
  if (opts.production) return 'require';
  let host: string;
  try { host = new URL(url).hostname; } catch { return 'require'; }
  return LOCAL_HOSTS.has(host) ? false : 'require';
}

/**
 * What's wrong with a Supabase DATABASE_URL for this app on Vercel, in words for the logs, or null if nothing is.
 * The app needs the SHARED pooler in TRANSACTION mode (host *.pooler.supabase.com, port 6543):
 * - the shared pooler on 5432 is session mode, capped at 15 clients ("max clients reached in session mode");
 * - db.<ref>.supabase.co (direct or dedicated pooler) is IPv6-only by default, which Vercel can't reach.
 */
export function databaseUrlProblem(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const port = u.port || '5432';
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(u.hostname)) {
    return 'DATABASE_URL points at db.<project>.supabase.co, which is IPv6-only and unreachable from Vercel. Use the shared transaction pooler: Supabase > Connect > Transaction pooler with "Use IPv4 connection" on (host *.pooler.supabase.com, port 6543).';
  }
  if (u.hostname.endsWith('.pooler.supabase.com') && port === '5432') {
    return 'DATABASE_URL uses the Supabase pooler in session mode (port 5432), which allows only 15 clients. Use port 6543 (transaction mode) on the same host.';
  }
  return null;
}

/** The app's pool (src/lib/db/admin.ts): small and short-lived for serverless functions behind the transaction pooler. */
export function appDbOptions(url: string, nodeEnv: string | undefined = process.env.NODE_ENV) {
  return {
    ...pgOptions,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: dbSsl(url, { production: nodeEnv === 'production' }),
  };
}

/** One-connection options for the command-line scripts (imports, reset, schema check). */
export function scriptDbOptions(url: string) {
  return { ...pgOptions, max: 1, ssl: dbSsl(url), onnotice: () => {} };
}
