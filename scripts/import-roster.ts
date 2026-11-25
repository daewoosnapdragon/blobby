// Usage: npx tsx scripts/import-roster.ts <roster.csv> [--dry-run]
// Prints counts only; never prints names or any student data.
import fs from 'node:fs';
import postgres from 'postgres';
import { scriptDbOptions } from '../src/lib/db/options';
import { importRoster, parseRoster } from '../src/lib/roster';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Usage: tsx scripts/import-roster.ts <roster.csv> [--dry-run]');

  const parsed = parseRoster(fs.readFileSync(file, 'utf8'));
  const byGrade = [1, 2, 3, 4].map((g) => parsed.students.filter((s) => s.grade === g).length);
  const line = (classes: number) => `classes ${classes}, students ${parsed.students.length} (${byGrade.join('/')})`;

  if (dryRun) {
    console.log(`dry run, nothing written: ${line(parsed.classes.length)}`);
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, scriptDbOptions(url));
  try {
    const r = await importRoster(sql, parsed);
    console.log(`classes ${r.classes}, students ${r.students} (${r.byGrade.join('/')})`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : 'import failed'); process.exit(1); });
