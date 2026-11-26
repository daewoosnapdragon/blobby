// Content file parsing and idempotent DB import. No server-only: scripts run this under tsx.
import { z } from 'zod';
import type postgres from 'postgres';
import { parseQuestion, type Question } from './questions/schema';
import { isSkillKey, type SkillKey } from './skills';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD').refine(
  (s) => { const d = new Date(`${s}T00:00:00Z`); return !isNaN(+d) && d.toISOString().startsWith(s); },
  'is not a real date',
);
const nonEmpty = z.string().trim().min(1);

const fileSchema = z.object({
  plan: z.object({ title: nonEmpty, kind: z.enum(['test', 'winter', 'homework']) }),
  assignTo: z.object({ grade: z.number().int().min(1).max(4) }),
  weeks: z.array(z.object({
    skill: nonEmpty,
    opensOn: dateStr,
    lessons: z.array(z.object({ title: nonEmpty, questions: z.array(z.unknown()).min(1) })).min(1),
  })).min(1),
});

export interface ContentFile {
  plan: { title: string; kind: 'test' | 'winter' | 'homework' };
  assignTo: { grade: number };
  /** skills[i] is questions[i]'s skill key (src/lib/skills.ts), or null */
  weeks: { skill: string; opensOn: string; lessons: { title: string; questions: Question[]; skills: (SkillKey | null)[] }[] }[];
}

/** Validates the whole file; the error names week, lesson and 1-based question position. */
export function parseContent(raw: unknown): ContentFile {
  const shape = fileSchema.safeParse(raw);
  if (!shape.success) {
    const msg = shape.error.issues.map((i) => {
      const [k, wi, , li] = i.path;
      const where = k === 'weeks' && typeof wi === 'number'
        ? `week ${wi + 1}${typeof li === 'number' ? `, lesson ${li + 1}` : ''}: ` : '';
      return `${where}${i.path.join('.')}: ${i.message}`;
    }).join('; ');
    throw new Error(`Invalid content file: ${msg}`);
  }
  const f = shape.data;
  return {
    plan: f.plan,
    assignTo: f.assignTo,
    weeks: f.weeks.map((w, wi) => ({
      skill: w.skill,
      opensOn: w.opensOn,
      lessons: w.lessons.map((l, li) => ({
        title: l.title,
        skills: l.questions.map((raw, qi) => {
          const skill = raw && typeof raw === 'object' ? (raw as { skill?: unknown }).skill : undefined;
          if (skill === undefined || skill === null) return null;
          if (!isSkillKey(skill)) throw new Error(`week ${wi + 1}, lesson ${li + 1}, question ${qi + 1}: unknown skill ${JSON.stringify(skill)}`);
          return skill;
        }),
        questions: l.questions.map((raw, qi) => {
          const where = `week ${wi + 1}, lesson ${li + 1}, question ${qi + 1}`;
          if (!raw || typeof raw !== 'object' || typeof (raw as { type?: unknown }).type !== 'string') {
            throw new Error(`${where}: missing "type"`);
          }
          const { type, skill: _skill, ...payload } = raw as { type: string; skill?: unknown };
          try { return parseQuestion(type, payload); }
          catch (e) { throw new Error(`${where}: ${e instanceof Error ? e.message : String(e)}`); }
        }),
      })),
    })),
  };
}

export interface ImportedQuestion { id: string; question: Question; audio: Record<string, unknown> }
export interface ImportResult {
  weeks: number; lessons: number; questions: number; items: ImportedQuestion[];
  /** existing questions whose payload differs from the file and were left as they are in the app (always 0 with overwrite) */
  differing: number;
  /** existing weeks whose skill or opens_on differs from the file; the app's values were kept (always 0 with overwrite) */
  keptWeeks: number;
  /** existing lessons whose title differs from the file; the app's title was kept (always 0 with overwrite) */
  keptLessons: number;
  /** positions where the teacher deleted the question in the app; left deleted, not re-inserted (always 0 with overwrite) */
  keptDeleted: number;
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as object).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/**
 * One transaction. Unchanged content writes nothing. The teacher's edits in the app win by default (R37):
 * an existing week keeps its skill and opens_on, a lesson its title, a question its payload (each counted),
 * and a question she deleted stays deleted. `overwrite` makes the file win everywhere, and inserts a fresh
 * question where one was deleted.
 */
export async function importContent(sql: postgres.Sql, c: ContentFile, opts: { overwrite?: boolean } = {}): Promise<ImportResult> {
  return sql.begin(async (tx) => {
    const [cls] = await tx`select id from wp_classes where grade = ${c.assignTo.grade} order by name, id limit 1`;
    if (!cls) throw new Error(`No class for grade ${c.assignTo.grade}; import the roster first`);

    const [plan] = await tx`
      insert into wp_plans (title, kind) values (${c.plan.title}, ${c.plan.kind})
      on conflict (title) do update set kind = excluded.kind returning id`;
    const [assigned] = await tx`select 1 as x from wp_plan_assignments where plan_id = ${plan.id} and class_id = ${cls.id} limit 1`;
    if (!assigned) await tx`insert into wp_plan_assignments (plan_id, class_id) values (${plan.id}, ${cls.id})`;

    const items: ImportedQuestion[] = [];
    let lessons = 0;
    let differing = 0, keptWeeks = 0, keptLessons = 0, keptDeleted = 0;
    for (const [wi, w] of c.weeks.entries()) {
      let [week] = await tx<{ id: string; skill: string; opens_on: string | null }[]>`
        select id, skill, opens_on::text as opens_on from wp_weeks where plan_id = ${plan.id} and position = ${wi + 1}`;
      if (!week) {
        [week] = await tx`
          insert into wp_weeks (plan_id, position, skill, opens_on) values (${plan.id}, ${wi + 1}, ${w.skill}, ${w.opensOn})
          returning id, skill, opens_on::text as opens_on`;
      } else if (week.skill !== w.skill || week.opens_on !== w.opensOn) {
        if (opts.overwrite) await tx`update wp_weeks set skill = ${w.skill}, opens_on = ${w.opensOn} where id = ${week.id}`;
        else keptWeeks++;
      }
      for (const [li, l] of w.lessons.entries()) {
        lessons++;
        let [lesson] = await tx<{ id: string; title: string }[]>`
          select id, title from wp_lessons where week_id = ${week.id} and position = ${li + 1}`;
        if (!lesson) {
          [lesson] = await tx`
            insert into wp_lessons (week_id, position, title) values (${week.id}, ${li + 1}, ${l.title}) returning id, title`;
        } else if (lesson.title !== l.title) {
          if (opts.overwrite) await tx`update wp_lessons set title = ${l.title} where id = ${lesson.id}`;
          else keptLessons++;
        }
        for (const [qi, q] of l.questions.entries()) {
          const { type, ...payload } = q;
          const skill = l.skills[qi] ?? null;
          const [existing] = await tx`
            select id, type, payload, audio from wp_questions
            where lesson_id = ${lesson.id} and position = ${qi + 1} and deleted_at is null
            order by updated_at desc limit 1`;
          if (!existing && !opts.overwrite) {
            const [gone] = await tx`
              select 1 as x from wp_questions where lesson_id = ${lesson.id} and position = ${qi + 1} and deleted_at is not null limit 1`;
            if (gone) { keptDeleted++; continue; }
          }
          if (!existing) {
            const [row] = await tx`
              insert into wp_questions (lesson_id, position, type, payload, skill)
              values (${lesson.id}, ${qi + 1}, ${type}, ${tx.json(payload as never)}, ${skill}) returning id`;
            items.push({ id: row.id, question: q, audio: {} });
          } else {
            // The skill tag isn't something Kyla edits in the app: the file's tag always wins.
            await tx`update wp_questions set skill = ${skill} where id = ${existing.id} and skill is distinct from ${skill}`;
            const differs = existing.type !== type || stable(existing.payload) !== stable(payload);
            if (differs && opts.overwrite) {
              await tx`update wp_questions set type = ${type}, payload = ${tx.json(payload as never)}, updated_at = now()
                where id = ${existing.id}`;
              items.push({ id: existing.id, question: q, audio: existing.audio ?? {} });
            } else if (differs) {
              differing++;
              try { items.push({ id: existing.id, question: parseQuestion(existing.type, existing.payload), audio: existing.audio ?? {} }); }
              catch { /* the app's version is malformed: nothing to make audio for */ }
            } else {
              items.push({ id: existing.id, question: q, audio: existing.audio ?? {} });
            }
          }
        }
      }
    }
    return { weeks: c.weeks.length, lessons, questions: items.length, items, differing, keptWeeks, keptLessons, keptDeleted };
  });
}

/** What the import left as the teacher has it in the app (R37), one line each. */
export function keptSummary(
  r: Pick<ImportResult, 'differing' | 'keptWeeks' | 'keptLessons' | 'keptDeleted'>,
  overwrite: boolean,
): string[] {
  if (overwrite) return ['--overwrite: the file replaced any edits made in the app'];
  const lines = [
    r.keptWeeks && `${r.keptWeeks} week(s) have a different skill or open date in the app; kept the app's values`,
    r.keptLessons && `${r.keptLessons} lesson title(s) differ from the file; kept the app's titles`,
    r.differing && `${r.differing} question(s) differ from the file; kept the app's version`,
    r.keptDeleted && `${r.keptDeleted} question(s) were deleted in the app; left deleted`,
  ].filter((x): x is string => typeof x === 'string');
  if (lines.length === 0) return ['no edits from the app were in the way'];
  return [...lines, 'Run again with --overwrite to make the file win (this replaces those edits).'];
}
