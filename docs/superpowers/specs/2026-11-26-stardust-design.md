# Stardust (design)

Approved in chat with Kyla, Nov 26.

## Why

Kids earn far too many stars: a lesson gives 10, a finished week 10 more, and free practice 1 for every right answer,
every time (about 60+ a week, and practice can be replayed for more). Kyla wants about **5–10 stars a week**, so a
star means something. Stardust is the small reward along the way.

## Rules (Kyla's)

- A question answered right **on the first try** gives **1 stardust**, in lessons and in practice
  (only a kid's first try at a question is saved already, so this is "the saved answer is right").
- **Each question gives stardust once per kid, ever** (Kyla picked this over "every time" and "every time up to a
  daily limit"): replaying a lesson or practicing a known question gives none. Review questions count the same way.
- **20 stardust = 1 star.**
- Finishing a lesson (first time) = **1 star**; finishing a week = **2 stars**.

A full week then gives about 7 stars from lessons plus 2–4 from stardust.

Non-goals: no daily limits, no spending stars, no changes to what earns a lesson or week completion.

## Approaches

1. **(Picked) One reward list, counted in stardust.** Keep `wp_star_events`; every amount is in stardust:
   answer 1, lesson 20, week 40. Stars = total ÷ 20 (rounded down); the leftover fills the bar. Every screen keeps
   reading the same total, so no two places can disagree.
2. A separate stardust list beside stars: two totals to keep in step, and turning 20 stardust into a star is awkward.
3. Working stardust out from saved answers on the fly: harder to show "+1 stardust" as it happens, easier to get wrong.

## The design

- **Data**
  - A new reward reason `stardust`, one per kid per question (`ref_id` = question id; the existing unique
    `(student_id, reason, ref_id)` makes "once ever" hold even under retries and races).
  - Awarded by `recordAttempt` when the answer is right, in a lesson or practice.
  - Lesson = 20, week = 40 (`STAR_VALUES` becomes stardust values, plus `DUST_PER_STAR = 20`).
  - Free practice stops giving `free_correct` stars.
  - Plan for the reward: a class question's own plan. A review question's goes to the plan on the kid's home screen,
    and gets nothing with no plan (as today).
- **Existing rewards (my call):** the migration converts them to the new scale: a lesson row → 20, a week row → 40,
  an old practice star → 1 stardust. Totals so far shrink to match the new rules instead of starting at 60+.
  Very few kids have played yet, so this barely moves anything.
- **Kids see**
  - Beside the star count (home, lesson and practice top bars): a small stardust bar, `14/20`.
  - A first-try right answer on a question that hasn't given stardust yet shows **+1 stardust**
    (the lesson and practice data say which questions already have).
  - When the bar fills: **+1 star!** and the bar starts over.
  - Lesson done: **+1 star** (first time) and how much stardust this lesson gave.
  - Week done: **+2 stars**.
  - Practice done: stardust earned.
  - Home's free-practice card says "for stardust" instead of "for bonus stars".
- **Kyla sees:** the class page and student page show stars (total ÷ 20) as now; the numbers are just smaller.
- **Practice student:** reset clears its stardust with its other rewards (already the case: it deletes all rewards).

## Left to the builder

The exact look of the bar and the "+1 stardust" moment (Blobby style; motion only on transform, none under reduced
motion), and the copy details.
