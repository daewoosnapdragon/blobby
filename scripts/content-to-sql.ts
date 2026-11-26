// Usage: npx tsx scripts/content-to-sql.ts <out.sql> <content.json> [...]
// Turns content files into one SQL file for the Supabase SQL editor, doing what import-content.ts does
// (without audio): plans upserted by title and assigned to their grade's class; weeks, lessons and questions
// added only where missing, so teacher edits and deleted questions in the app are kept. Safe to run twice.
import fs from 'node:fs';
import { parseContent, type ContentFile } from '../src/lib/content';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function contentToSql(c: ContentFile): string {
  const title = q(c.plan.title);
  const grade = c.assignTo.grade;
  const plan = `(select id from wp_plans where title = ${title})`;
  const out: string[] = [
    `-- ${c.plan.title}`,
    `do $$ begin if not exists (select 1 from wp_classes where grade = ${grade}) then`,
    `  raise exception 'No class for grade ${grade}: import the roster first'; end if; end $$;`,
    `insert into wp_plans (title, kind) values (${title}, ${q(c.plan.kind)}) on conflict (title) do update set kind = excluded.kind;`,
    `insert into wp_plan_assignments (plan_id, class_id)`,
    `  select ${plan}, (select id from wp_classes where grade = ${grade} order by name, id limit 1)`,
    `  where not exists (select 1 from wp_plan_assignments where plan_id = ${plan}`,
    `    and class_id = (select id from wp_classes where grade = ${grade} order by name, id limit 1));`,
  ];
  c.weeks.forEach((w, wi) => {
    const wpos = wi + 1;
    const week = `(select id from wp_weeks where plan_id = ${plan} and position = ${wpos})`;
    out.push(`insert into wp_weeks (plan_id, position, skill, opens_on) values (${plan}, ${wpos}, ${q(w.skill)}, ${q(w.opensOn)})`);
    out.push(`  on conflict (plan_id, position) do nothing;`);
    w.lessons.forEach((l, li) => {
      const lpos = li + 1;
      const lesson = `(select id from wp_lessons where week_id = ${week} and position = ${lpos})`;
      out.push(`insert into wp_lessons (week_id, position, title) values (${week}, ${lpos}, ${q(l.title)})`);
      out.push(`  on conflict (week_id, position) do nothing;`);
      l.questions.forEach((question, qi) => {
        const { type, ...payload } = question;
        const qpos = qi + 1;
        out.push(`insert into wp_questions (lesson_id, position, type, payload) select ${lesson}, ${qpos}, ${q(type)}, ${q(JSON.stringify(payload))}::jsonb`);
        out.push(`  where not exists (select 1 from wp_questions where lesson_id = ${lesson} and position = ${qpos});`);
      });
    });
  });
  return out.join('\n');
}

function main() {
  const [outFile, ...files] = process.argv.slice(2);
  if (!outFile || files.length === 0) throw new Error('Usage: tsx scripts/content-to-sql.ts <out.sql> <content.json> [...]');
  const parts = ['-- Blobby lessons. Run in the Supabase SQL editor after the roster. Safe to run more than once.', 'begin;'];
  const summary: string[] = [];
  for (const f of files) {
    const c = parseContent(JSON.parse(fs.readFileSync(f, 'utf8')));
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
