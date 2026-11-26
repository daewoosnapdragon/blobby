// Usage: npx tsx scripts/content-to-sql.ts <out.sql> <content.json | review-bank-gN.json> [...]
// Turns content files into one SQL file for the Supabase SQL editor, doing what import-content.ts does
// (without audio): plans upserted by title and assigned to their grade's class; weeks, lessons and questions
// added only where missing, so teacher edits and deleted questions in the app are kept. Safe to run twice.
import fs from 'node:fs';
import { parseContent } from '../src/lib/content';
import { parseBank } from '../src/lib/bank';
import { bankToSql, contentToSql } from '../src/lib/contentSql';

function main() {
  const [outFile, ...files] = process.argv.slice(2);
  if (!outFile || files.length === 0) throw new Error('Usage: tsx scripts/content-to-sql.ts <out.sql> <content.json> [...]');
  const parts = ['-- Blobby lessons. Run in the Supabase SQL editor after the roster. Safe to run more than once.', 'begin;'];
  const summary: string[] = [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (raw && typeof raw === 'object' && 'skills' in raw && !('weeks' in raw)) {
      const b = parseBank(raw);
      parts.push('', bankToSql(b));
      summary.push(`Review bank grade ${b.grade}: ${b.questions.length} questions`);
      continue;
    }
    const c = parseContent(raw);
    parts.push('', contentToSql(c));
    const n = c.weeks.reduce((s, w) => s + w.lessons.reduce((t, l) => t + l.questions.length, 0), 0);
    summary.push(`${c.plan.title}: ${c.weeks.length} week(s), ${c.weeks.reduce((s, w) => s + w.lessons.length, 0)} lessons, ${n} questions`);
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
