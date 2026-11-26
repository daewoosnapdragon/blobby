// Usage: npx tsx scripts/content-to-sql.ts <out.sql> <content.json | review-bank-gN.json> [...]
//        npx tsx scripts/content-to-sql.ts <out.sql> --update --base <dir | git:<ref>> <file...>
// Turns content files into one SQL file for the Supabase SQL editor, doing what import-content.ts does
// (without audio): plans upserted by title and assigned to their grade's class; weeks, lessons and questions
// added only where missing, so teacher edits and deleted questions in the app are kept. Safe to run twice.
//
// --update writes a two-part script instead: PART 1 (read-only) lists questions in the app whose payload differs
// from the base file (the same file as it was before this edit), PART 2 updates questions in place by position,
// adds missing positions and leaves teacher-deleted ones deleted. --base is a directory holding the base files
// under the same names, or git:<ref> to read each file as it is at that commit (git show <ref>:<path>).
// Without --base, PART 1 lists every existing question PART 2 touches.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseContent } from '../src/lib/content';
import { parseBank } from '../src/lib/bank';
import { bankApplySql, bankLookSql, bankToSql, contentApplySql, contentLookSql, contentToSql, updateSqlDocument } from '../src/lib/contentSql';

const USAGE = 'Usage: tsx scripts/content-to-sql.ts <out.sql> [--update [--base <dir | git:<ref>>]] <content.json> [...]';

function parseArgs(argv: string[]) {
  const [outFile, ...rest] = argv;
  let update = false;
  let base: string | undefined;
  const files: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--update') update = true;
    else if (rest[i] === '--base') { base = rest[++i]; if (!base) throw new Error(`--base needs a directory or git:<ref>\n${USAGE}`); }
    else files.push(rest[i]);
  }
  if (!outFile || outFile.startsWith('--') || files.length === 0) throw new Error(USAGE);
  if (base && !update) throw new Error(`--base only applies with --update\n${USAGE}`);
  return { outFile, update, base, files };
}

/** The base version of `file` as text, or null (with a warning) when the base has no such file. */
function readBase(base: string, file: string): string | null {
  if (base.startsWith('git:')) {
    const ref = base.slice(4);
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const rel = path.relative(top, path.resolve(file)).split(path.sep).join('/');
    try {
      return execFileSync('git', ['show', `${ref}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      console.warn(`Warning: ${rel} is not in ${ref}; PART 1 lists every existing question for it.`);
      return null;
    }
  }
  const p = path.join(base, path.basename(file));
  if (!fs.existsSync(p)) {
    console.warn(`Warning: no ${p}; PART 1 lists every existing question for ${file}.`);
    return null;
  }
  return fs.readFileSync(p, 'utf8');
}

const isBank = (raw: unknown) => !!raw && typeof raw === 'object' && 'skills' in raw && !('weeks' in raw);

function main() {
  const { outFile, update, base, files } = parseArgs(process.argv.slice(2));
  const parts = ['-- Blobby lessons. Run in the Supabase SQL editor after the roster. Safe to run more than once.', 'begin;'];
  const looks: string[] = [];
  const applies: string[] = [];
  const summary: string[] = [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    const baseText = update && base ? readBase(base, f) : null;
    const baseRaw = baseText === null ? undefined : JSON.parse(baseText);
    if (baseRaw !== undefined && isBank(baseRaw) !== isBank(raw)) throw new Error(`${f}: the base file is a different kind of file`);
    if (isBank(raw)) {
      const b = parseBank(raw);
      if (update) { looks.push(bankLookSql(b, baseRaw && parseBank(baseRaw))); applies.push(bankApplySql(b)); }
      else parts.push('', bankToSql(b));
      summary.push(`Review bank grade ${b.grade}: ${b.questions.length} questions`);
      continue;
    }
    const c = parseContent(raw);
    if (update) { looks.push(contentLookSql(c, baseRaw && parseContent(baseRaw))); applies.push(contentApplySql(c)); }
    else parts.push('', contentToSql(c));
    const n = c.weeks.reduce((s, w) => s + w.lessons.reduce((t, l) => t + l.questions.length, 0), 0);
    summary.push(`${c.plan.title}: ${c.weeks.length} week(s), ${c.weeks.reduce((s, w) => s + w.lessons.length, 0)} lessons, ${n} questions`);
  }
  if (update) {
    fs.writeFileSync(outFile, updateSqlDocument(looks, applies));
    console.log(summary.join('\n'));
    return;
  }
  parts.push('commit;', '', '-- Check: lessons and questions per plan',
    'select p.title, count(distinct l.id) as lessons, count(q.id) as questions from wp_plans p',
    '  join wp_weeks w on w.plan_id = p.id join wp_lessons l on l.week_id = w.id',
    '  left join wp_questions q on q.lesson_id = l.id and q.deleted_at is null',
    '  group by p.title order by p.title;');
  fs.writeFileSync(outFile, parts.join('\n') + '\n');
  console.log(summary.join('\n'));
}

main();
