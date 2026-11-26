// SQL for the Supabase SQL editor (Kyla runs it; no script access to the live database).
// contentToSql does what importContent does, without audio: plans upserted by title and assigned to their grade's
// class; weeks, lessons and questions added only where missing (teacher edits and deletions are kept); skill tags
// always follow the file. bankToSql adds review-bank questions once per (grade, skill, position) and
// updates one whose text changed in the file.
//
// With { update: true } both write a two-part script instead (see updateSqlDocument): PART 1 only reads and
// lists the rows whose payload in the app differs from `base` (the file as it was before this edit, so an
// in-app teacher edit shows up); PART 2 updates questions in place by position (row ids kept), inserts missing
// positions, never re-inserts a position the teacher deleted, and changes nothing on a second run.
import type { ContentFile } from './content';
import type { BankFile } from './bank';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const opt = (s: string | null) => (s === null ? 'null' : q(s));
const json = (payload: unknown) => `${q(JSON.stringify(payload))}::jsonb`;

export interface SqlOptions<T> { update?: boolean; base?: T }

/** The statements both modes share: class check, plan upsert and assignment, weeks and lessons added where missing. */
function planSql(c: ContentFile, perQuestion: (lesson: string, qpos: number, type: string, payload: string, skill: string) => string[]): string[] {
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
        out.push(...perQuestion(lesson, qi + 1, q(type), json(payload), opt(l.skills[qi] ?? null)));
      });
    });
  });
  return out;
}

/** A `(values ...) as v(...)` source; with no rows, an empty select of the same shape. */
function valuesSource(cols: string[], types: string[], rows: string[][]): string {
  if (rows.length === 0) return `(select ${cols.map((c, i) => `null::${types[i]} as ${c}`).join(', ')} where false) as v`;
  const lines = rows.map((r, ri) => `  (${r.map((x, i) => (ri === 0 ? `${x}::${types[i]}` : x)).join(', ')})`);
  return `(values\n${lines.join(',\n')}\n) as v(${cols.join(', ')})`;
}

/** PART 1 for a plan file: rows in the app at the file's positions whose payload differs from the base's (or the base lacks). */
export function contentLookSql(c: ContentFile, base?: ContentFile): string {
  const rows: string[][] = [];
  c.weeks.forEach((w, wi) => w.lessons.forEach((l, li) => l.questions.forEach((_, qi) => {
    const bq = base?.weeks[wi]?.lessons[li]?.questions[qi];
    let baseJson = 'null';
    if (bq) { const { type: _t, ...payload } = bq; baseJson = q(JSON.stringify(payload)); }
    rows.push([String(wi + 1), String(li + 1), String(qi + 1), baseJson]);
  })));
  return [
    `-- ${c.plan.title}: questions in the app that differ from ${base ? 'the file before this edit' : 'this file (no base file given, so every one is listed)'}`,
    `select v.wpos as week_position, v.lpos as lesson_position, v.qpos as question_position,`,
    `       left(qq.payload::text, 60) as app_text, left(v.base::jsonb::text, 60) as file_text`,
    `from ${valuesSource(['wpos', 'lpos', 'qpos', 'base'], ['int', 'int', 'int', 'text'], rows)}`,
    `join wp_plans p on p.title = ${q(c.plan.title)}`,
    `join wp_weeks w on w.plan_id = p.id and w.position = v.wpos`,
    `join wp_lessons l on l.week_id = w.id and l.position = v.lpos`,
    `join wp_questions qq on qq.lesson_id = l.id and qq.position = v.qpos and qq.deleted_at is null`,
    `where v.base is null or qq.payload <> v.base::jsonb`,
    `order by 1, 2, 3;`,
  ].join('\n');
}

/** PART 2 for a plan file (no begin/commit): update by position, insert where no row (deleted or not) exists. */
export function contentApplySql(c: ContentFile): string {
  return planSql(c, (lesson, qpos, type, payload, skill) => {
    const at = `lesson_id = ${lesson} and position = ${qpos}`;
    return [
      `update wp_questions set type = ${type}, payload = ${payload}, skill = ${skill}, updated_at = now()`,
      `  where ${at} and deleted_at is null`,
      `  and (type <> ${type} or payload <> ${payload} or skill is distinct from ${skill});`,
      `insert into wp_questions (lesson_id, position, type, payload, skill) select ${lesson}, ${qpos}, ${type}, ${payload}, ${skill}`,
      `  where not exists (select 1 from wp_questions where ${at});`,
    ];
  }).join('\n');
}

/** PART 1 for a bank file, by (bank_grade, skill, position). */
export function bankLookSql(b: BankFile, base?: BankFile): string {
  const baseAt = new Map((base?.questions ?? []).map((x) => [`${x.skill}#${x.position}`, x.question]));
  const rows = b.questions.map(({ skill, position }) => {
    const bq = baseAt.get(`${skill}#${position}`);
    let baseJson = 'null';
    if (bq) { const { type: _t, ...payload } = bq; baseJson = q(JSON.stringify(payload)); }
    return [q(skill), String(position), baseJson];
  });
  return [
    `-- Review bank, grade ${b.grade}: questions in the app that differ from ${base ? 'the file before this edit' : 'this file (no base file given, so every one is listed)'}`,
    `select qq.bank_grade, v.skill, v.pos as question_position,`,
    `       left(qq.payload::text, 60) as app_text, left(v.base::jsonb::text, 60) as file_text`,
    `from ${valuesSource(['skill', 'pos', 'base'], ['text', 'int', 'text'], rows)}`,
    `join wp_questions qq on qq.bank_grade = ${b.grade} and qq.skill = v.skill and qq.position = v.pos and qq.deleted_at is null`,
    `where v.base is null or qq.payload <> v.base::jsonb`,
    `order by 2, 3;`,
  ].join('\n');
}

/** PART 2 for a bank file (no begin/commit). */
export function bankApplySql(b: BankFile): string {
  const out = [`-- Review bank, grade ${b.grade}: ${b.questions.length} questions`];
  for (const { skill, position, question } of b.questions) {
    const { type, ...payload } = question;
    const at = `bank_grade = ${b.grade} and skill = ${q(skill)} and position = ${position}`;
    out.push(`update wp_questions set type = ${q(type)}, payload = ${json(payload)}, updated_at = now()`);
    out.push(`  where ${at} and deleted_at is null and (type <> ${q(type)} or payload <> ${json(payload)});`);
    out.push(`insert into wp_questions (bank_grade, skill, position, type, payload) select ${b.grade}, ${q(skill)}, ${position}, ${q(type)}, ${json(payload)}`);
    out.push(`  where not exists (select 1 from wp_questions where ${at});`);
  }
  return out.join('\n');
}

/** The whole update-mode script: header, PART 1 (the look selects), a stop banner, PART 2 in one transaction. */
export function updateSqlDocument(looks: string[], applies: string[]): string {
  return [
    '-- ============================================================================',
    '-- Blobby: update lessons and review questions from the content files',
    '-- ============================================================================',
    '-- What this does: puts the questions from the files into the app. A question',
    '-- already in the app is changed in place (same question, so kids\' answers and',
    '-- stars stay linked to it). A question the app does not have yet is added.',
    '-- What it keeps: questions the teacher deleted stay deleted (they are not added',
    '-- back or changed), kids\' answers, stars and audio. Plans, weeks and lessons are',
    '-- only added where missing. It only touches wp_ tables. Running it twice is safe',
    '-- (the second run changes nothing).',
    '-- BUT: a question the teacher edited in the app is replaced by the file\'s version.',
    '-- PART 1 lists those, so you can check first.',
    '--',
    '-- How to use: paste PART 1 into the Supabase SQL editor and run it. Read the',
    '-- rows. If they look right, paste PART 2 and run it.',
    '-- ============================================================================',
    '',
    '',
    '-- ============================ PART 1: LOOK FIRST ============================',
    '-- Safe to run any time: it only reads, it never changes anything.',
    '-- One list per file: questions in the app whose text is not what the file had',
    '-- before this edit (for example a teacher edit). PART 2 replaces them.',
    '--   app_text  = the start of the question as it is in the app now',
    '--   file_text = the start of the question as the file had it before (empty if new)',
    '-- No rows means nothing in the app will be lost.',
    '',
    looks.join('\n\n'),
    '',
    '',
    '-- ############################################################################',
    '-- ##',
    '-- ##  STOP. Run PART 1 alone first and read the rows. Only then select and run PART 2.',
    '-- ##',
    '-- ############################################################################',
    '-- >>> PART 2 STARTS HERE <<<',
    '-- ============================ PART 2: APPLY ================================',
    '-- Only run this after you checked the rows from PART 1.',
    '-- It runs as one all-or-nothing step: either every change happens, or none.',
    '',
    'begin;',
    '',
    applies.join('\n\n'),
    '',
    'commit;',
    '',
  ].join('\n');
}

export function contentToSql(c: ContentFile, opts: SqlOptions<ContentFile> = {}): string {
  if (opts.update) return updateSqlDocument([contentLookSql(c, opts.base)], [contentApplySql(c)]);
  return planSql(c, (lesson, qpos, type, payload, skill) => [
    `insert into wp_questions (lesson_id, position, type, payload, skill) select ${lesson}, ${qpos}, ${type}, ${payload}, ${skill}`,
    `  where not exists (select 1 from wp_questions where lesson_id = ${lesson} and position = ${qpos});`,
    `update wp_questions set skill = ${skill} where lesson_id = ${lesson} and position = ${qpos} and skill is distinct from ${skill};`,
  ]).join('\n');
}

export function bankToSql(b: BankFile, opts: SqlOptions<BankFile> = {}): string {
  if (opts.update) return updateSqlDocument([bankLookSql(b, opts.base)], [bankApplySql(b)]);
  const out = [`-- Review bank, grade ${b.grade}: ${b.questions.length} questions`];
  for (const { skill, position, question } of b.questions) {
    const { type, ...payload } = question;
    out.push(`insert into wp_questions (bank_grade, skill, position, type, payload) select ${b.grade}, ${q(skill)}, ${position}, ${q(type)}, ${q(JSON.stringify(payload))}::jsonb`);
    out.push(`  where not exists (select 1 from wp_questions where bank_grade = ${b.grade} and skill = ${q(skill)} and position = ${position});`);
    out.push(`update wp_questions set type = ${q(type)}, payload = ${q(JSON.stringify(payload))}::jsonb where bank_grade = ${b.grade} and skill = ${q(skill)} and position = ${position}`);
    out.push(`  and (type <> ${q(type)} or payload <> ${q(JSON.stringify(payload))}::jsonb);`);
  }
  return out.join('\n');
}
