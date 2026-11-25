// Usage: npx tsx scripts/import-content.ts <content.json> [--dry-run] [--no-audio] [--overwrite]
// By default the teacher's edits in the app win (week skill/date, lesson titles, questions, deleted questions);
// --overwrite makes the file win.
// Needs DATABASE_URL; audio also needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
import fs from 'node:fs';
import postgres from 'postgres';
import { scriptDbOptions } from '../src/lib/db/options';
import { importContent, keptSummary, parseContent } from '../src/lib/content';
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
  const sql = postgres(url, scriptDbOptions(url));
  try {
    const r = await importContent(sql, content, { overwrite });
    console.log(`plan "${content.plan.title}": weeks ${r.weeks}, lessons ${r.lessons}, questions ${r.questions}`);
    for (const line of keptSummary(r, overwrite)) console.log(line);
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
