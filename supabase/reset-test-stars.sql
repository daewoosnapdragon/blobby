-- ============================================================================
-- Blobby: reset the TEST stars before break
-- ============================================================================
-- What this does: removes every star the kids earned on the test plan(s), and
-- takes the test plan(s) off the kids' home screens.
-- What it keeps: practice days (calendar), blob colors, lesson completions,
-- answers, and all stars from the winter/homework plans.
-- It only touches wp_ tables. Running it twice is safe (the second run does nothing).
--
-- How to use: paste PART 1 into the Supabase SQL editor and run it. Read the
-- numbers. If they look right, paste PART 2 and run it.
-- ============================================================================


-- ============================ PART 1: LOOK FIRST ============================
-- Safe to run any time: it only reads, it never changes anything.
-- One row per test plan, plus a TOTAL row at the bottom.
--   star_events_to_delete = stars records that PART 2 would delete
--   assignments_to_remove = classes/kids that would stop seeing that plan

select plan, star_events_to_delete, assignments_to_remove
from (
  select p.title as plan,
         (select count(*) from wp_star_events e where e.plan_id = p.id) as star_events_to_delete,
         (select count(*) from wp_plan_assignments a where a.plan_id = p.id) as assignments_to_remove,
         0 as sort_order
  from wp_plans p
  where p.kind = 'test'
  union all
  select 'TOTAL',
         (select count(*) from wp_star_events e where e.plan_id in (select id from wp_plans where kind = 'test')),
         (select count(*) from wp_plan_assignments a where a.plan_id in (select id from wp_plans where kind = 'test')),
         1
) t
order by sort_order, plan;


-- >>> PART 2 STARTS HERE <<<
-- ============================ PART 2: DO THE RESET ==========================
-- Only run this after you checked the numbers from PART 1.
-- It runs as one all-or-nothing step: either both deletes happen, or neither.

begin;

-- 1. Delete the stars earned on test plans.
delete from wp_star_events
where plan_id in (select id from wp_plans where kind = 'test');

-- 2. Take the test plans off the kids' home screens.
delete from wp_plan_assignments
where plan_id in (select id from wp_plans where kind = 'test');

commit;
