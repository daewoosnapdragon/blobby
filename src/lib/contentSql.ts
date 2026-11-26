// SQL for the Supabase SQL editor (Kyla runs it; no script access to the live database).
// contentToSql does what importContent does, without audio: plans upserted by title and assigned to their grade's
// class; weeks, lessons and questions added only where missing (teacher edits and deletions are kept); skill tags
// always follow the file. bankToSql adds review-bank questions once per (grade, skill, position).
import type { ContentFile } from './content';
import type { BankFile } from './bank';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const opt = (s: string | null) => (s === null ? 'null' : q(s));

export function contentToSql(c: ContentFile): string {
  const title = q(c.plan.title);
  const grade = c.assignTo.grade;
  const plan = `(select id from wp_plans where title = ${title})`;
  const cls = `(select id from wp_classes where grade = ${grade} order by name, id limit 1)`;
  const out: string[] = [
    `-- ${c.plan.title}`,
    `do $$ begin if not exists (select 1 from wp_classes where grade = ${grade}) then`,
    `  raise exception 'No class for grade ${grade}: import the roster first'; end if; end $$;`,
    `insert into wp_plans (title, kind) values (${title}, ${q(c.plan.kind)}) on conflict (title) do update set kind = excluded.kind;`,
    `insert into wp_plan_assignments (plan_id, class_id)`,
    `  select ${plan}, ${cls} where not exists (select 1 from wp_plan_assignments where plan_id = ${plan} and class_id = ${cls});`,
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
        const skill = opt(l.skills[qi] ?? null);
        out.push(`insert into wp_questions (lesson_id, position, type, payload, skill) select ${lesson}, ${qpos}, ${q(type)}, ${q(JSON.stringify(payload))}::jsonb, ${skill}`);
        out.push(`  where not exists (select 1 from wp_questions where lesson_id = ${lesson} and position = ${qpos});`);
        out.push(`update wp_questions set skill = ${skill} where lesson_id = ${lesson} and position = ${qpos} and skill is distinct from ${skill};`);
      });
    });
  });
  return out.join('\n');
}

export function bankToSql(b: BankFile): string {
  const out = [`-- Review bank, grade ${b.grade}: ${b.questions.length} questions`];
  for (const { skill, position, question } of b.questions) {
    const { type, ...payload } = question;
    out.push(`insert into wp_questions (bank_grade, skill, position, type, payload) select ${b.grade}, ${q(skill)}, ${position}, ${q(type)}, ${q(JSON.stringify(payload))}::jsonb`);
    out.push(`  where not exists (select 1 from wp_questions where bank_grade = ${b.grade} and skill = ${q(skill)} and position = ${position});`);
  }
  return out.join('\n');
}
