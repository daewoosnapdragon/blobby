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
