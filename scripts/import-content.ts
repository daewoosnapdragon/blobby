// Usage: npx tsx scripts/import-content.ts <content.json> [--dry-run] [--no-audio] [--overwrite]
// Needs DATABASE_URL; audio also needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
import fs from 'node:fs';
import postgres from 'postgres';
import { pgOptions } from '../src/lib/db/options';
import { importContent, parseContent } from '../src/lib/content';
import { defaultAudioDeps, ensureAudio } from '../src/lib/tts';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noAudio = args.includes('--no-audio');
  const overwrite = args.includes('--overwrite');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Usage: tsx scripts/import-content.ts <content.json> [--dry-run] [--no-audio] [--overwrite]');

  const content = parseContent(JSON.parse(fs.readFileSync(file, 'utf8')));
  const nQ = content.weeks.flatMap((w) => w.lessons).reduce((n, l) => n + l.questions.length, 0);
  const nL = content.weeks.reduce((n, w) => n + w.lessons.length, 0);
  if (dryRun) {
    console.log(`dry run, nothing written: plan "${content.plan.title}", weeks ${content.weeks.length}, lessons ${nL}, questions ${nQ}`);
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const deps = noAudio ? null : await defaultAudioDeps(); // fail early on missing keys, before writing
  const sql = postgres(url, { ...pgOptions, max: 1, onnotice: () => {} });
  try {
    const r = await importContent(sql, content, { overwrite });
    console.log(`plan "${content.plan.title}": weeks ${r.weeks}, lessons ${r.lessons}, questions ${r.questions}`);
    if (r.differing > 0) console.log(`${r.differing} questions differ from the file; kept the app's version (use --overwrite to replace them)`);
    if (deps) {
      let updated = 0;
      for (const it of r.items) {
        const audio = await ensureAudio(it.question, deps);
        if (JSON.stringify(audio) !== JSON.stringify(it.audio)) {
          await sql`update wp_questions set audio = ${sql.json(audio)} where id = ${it.id}`;
          updated++;
        }
      }
      console.log(`audio: ${updated} question(s) updated`);
    } else console.log('audio skipped (--no-audio)');
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : 'import failed'); process.exit(1); });
