// Usage: npx tsx scripts/reset-test-stars.ts [--dry-run]
// Deletes star events from test plans and un-assigns those plans. Prints counts only.
import postgres from 'postgres';
import { pgOptions } from '../src/lib/db/options';
import { resetTestStars } from '../src/lib/resetTestStars';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, { ...pgOptions, max: 1, onnotice: () => {} });
  try {
    const r = await resetTestStars(sql, { dryRun });
    console.log(dryRun ? 'dry run, nothing changed. Would remove:' : 'done. Removed:');
    for (const p of r.byPlan) console.log(`  star events on "${p.title}": ${p.events}`);
    console.log(`  star events total: ${r.starEvents}`);
    console.log(`  plan assignments: ${r.assignments}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : 'reset failed'); process.exit(1); });
