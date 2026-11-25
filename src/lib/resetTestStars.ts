// Removes the stars earned on test plans (kind = 'test') and un-assigns those plans, before break.
// Same semantics as supabase/reset-test-stars.sql. Keeps practice days, blob colors, attempts,
// lesson completions, and stars from every non-test plan. Safe to run twice.
import type postgres from 'postgres';

export type ResetResult = {
  dryRun: boolean;
  starEvents: number;
  assignments: number;
  byPlan: { title: string; events: number }[];
};

export async function resetTestStars(sql: ReturnType<typeof postgres>, opts: { dryRun: boolean }): Promise<ResetResult> {
  const count = async (q: ReturnType<typeof postgres>) => {
    const byPlan = (await q<{ title: string; events: number }[]>`
      select p.title, count(e.id)::int as events
      from wp_plans p join wp_star_events e on e.plan_id = p.id
      where p.kind = 'test' group by p.title order by p.title`).map((r) => ({ title: r.title, events: Number(r.events) }));
    const [a] = await q<{ n: number }[]>`
      select count(*)::int as n from wp_plan_assignments where plan_id in (select id from wp_plans where kind = 'test')`;
    return { byPlan, starEvents: byPlan.reduce((s, r) => s + r.events, 0), assignments: Number(a.n) };
  };
  if (opts.dryRun) return { dryRun: true, ...(await count(sql)) };
  return sql.begin(async (tx) => {
    const before = await count(tx as unknown as ReturnType<typeof postgres>);
    await tx`delete from wp_star_events where plan_id in (select id from wp_plans where kind = 'test')`;
    await tx`delete from wp_plan_assignments where plan_id in (select id from wp_plans where kind = 'test')`;
    return { dryRun: false, ...before };
  }) as Promise<ResetResult>;
}
