// Run after Kyla applies 0001_wp_init.sql:  npx tsx --env-file=.env.local scripts/check-schema.ts
// Needs SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL. Read-only. Does not import src/lib/db/admin.ts (server-only).
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { scriptDbOptions } from '../src/lib/db/options';

const TABLES = [
  'wp_classes', 'wp_students', 'wp_plans', 'wp_plan_assignments', 'wp_weeks',
  'wp_lessons', 'wp_questions', 'wp_attempts', 'wp_lesson_completions',
  'wp_star_events', 'wp_practice_days',
];

function need(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var ${name}`); process.exit(1); }
  return v;
}

async function main() {
  const anon = createClient(need('SUPABASE_URL'), need('SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  let failures = 0;

  // 1. Anon must see nothing: zero rows or a permission error.
  for (const t of TABLES) {
    const { data, error } = await anon.from(t).select('*').limit(1);
    if (!error && data && data.length > 0) { console.error(`FAIL anon can read ${t}`); failures++; }
  }

  // 2. Tables exist, RLS on (service side, direct Postgres).
  const dbUrl = need('DATABASE_URL');
  const sql = postgres(dbUrl, scriptDbOptions(dbUrl));
  try {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname = any(${TABLES})`;
    const found = new Map(rows.map((r) => [r.relname, r.relrowsecurity]));
    for (const t of TABLES) {
      if (!found.has(t)) { console.error(`FAIL missing table ${t}`); failures++; }
      else if (!found.get(t)) { console.error(`FAIL RLS off on ${t}`); failures++; }
    }

    if (failures === 0) console.log(`${TABLES.length} tables ok, anon sees nothing`);

    // 3. Separate note (read-only): existing non-wp_ tables in public with RLS disabled.
    const open = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
        and c.relname not like 'wp\\_%' order by c.relname`;
    console.log('\nNote: existing non-wp_ tables in public with RLS disabled (nothing was changed):');
    console.log(open.length ? open.map((r) => `  - ${r.relname}`).join('\n') : '  (none)');
  } finally {
    await sql.end();
  }
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
