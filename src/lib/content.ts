// Content file parsing and idempotent DB import. No server-only: scripts run this under tsx.
import { z } from 'zod';
import type postgres from 'postgres';
import { parseQuestion, type Question } from './questions/schema';

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
  weeks: { skill: string; opensOn: string; lessons: { title: string; questions: Question[] }[] }[];
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
        questions: l.questions.map((raw, qi) => {
          const where = `week ${wi + 1}, lesson ${li + 1}, question ${qi + 1}`;
          if (!raw || typeof raw !== 'object' || typeof (raw as { type?: unknown }).type !== 'string') {
            throw new Error(`${where}: missing "type"`);
          }
          const { type, ...payload } = raw as { type: string };
          try { return parseQuestion(type, payload); }
          catch (e) { throw new Error(`${where}: ${e instanceof Error ? e.message : String(e)}`); }
        }),
      })),
    })),
  };
}

export interface ImportedQuestion { id: string; question: Question; audio: Record<string, unknown> }
export interface ImportResult { weeks: number; lessons: number; questions: number; items: ImportedQuestion[] }

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as object).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** One transaction. Unchanged content writes nothing. */
export async function importContent(sql: postgres.Sql, c: ContentFile): Promise<ImportResult> {
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
    for (const [wi, w] of c.weeks.entries()) {
      const [week] = await tx`
        insert into wp_weeks (plan_id, position, skill, opens_on) values (${plan.id}, ${wi + 1}, ${w.skill}, ${w.opensOn})
        on conflict (plan_id, position) do update set skill = excluded.skill, opens_on = excluded.opens_on returning id`;
      for (const [li, l] of w.lessons.entries()) {
        lessons++;
        const [lesson] = await tx`
          insert into wp_lessons (week_id, position, title) values (${week.id}, ${li + 1}, ${l.title})
          on conflict (week_id, position) do update set title = excluded.title returning id`;
        for (const [qi, q] of l.questions.entries()) {
          const { type, ...payload } = q;
          const [existing] = await tx`
            select id, type, payload, audio from wp_questions
            where lesson_id = ${lesson.id} and position = ${qi + 1} and deleted_at is null
            order by updated_at desc limit 1`;
          if (!existing) {
            const [row] = await tx`
              insert into wp_questions (lesson_id, position, type, payload)
              values (${lesson.id}, ${qi + 1}, ${type}, ${tx.json(payload as never)}) returning id`;
            items.push({ id: row.id, question: q, audio: {} });
          } else {
            if (existing.type !== type || stable(existing.payload) !== stable(payload)) {
              await tx`update wp_questions set type = ${type}, payload = ${tx.json(payload as never)}, updated_at = now()
                where id = ${existing.id}`;
            }
            items.push({ id: existing.id, question: q, audio: existing.audio ?? {} });
          }
        }
      }
    }
    return { weeks: c.weeks.length, lessons, questions: items.length, items };
  });
}
