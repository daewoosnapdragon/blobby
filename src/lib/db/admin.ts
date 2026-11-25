import 'server-only';
import postgres from 'postgres';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Sql = ReturnType<typeof postgres>;
let _sql: Sql | undefined;

function getSql(): Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    // prepare: false is required for the Supabase transaction pooler.
    _sql = postgres(url, { prepare: false });
  }
  return _sql;
}

/** Lazily-connected postgres client. Importing this module never throws; first use does if DATABASE_URL is missing. */
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_t, _this, args) => (getSql() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => Reflect.get(getSql(), prop),
}) as Sql;

/** supabase-js with the service role, for Storage only. Server/scripts only. */
export function getStorageAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, key, { auth: { persistSession: false } });
}
