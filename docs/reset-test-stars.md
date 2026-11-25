# Resetting test stars before break

**When:** after the test weeks are over and before winter break starts, so every kid begins break at 0 stars on the winter plan.

**What it does:** deletes the stars earned on test plans and removes the test plan from every class and kid, so it no longer shows on their home screen.

**What it keeps:** practice days (the calendar), blob colors, lesson completions, answers, and all stars from the winter and homework plans.

Running it twice is safe: the second run finds nothing to do.

## Steps (Supabase SQL editor)

1. Open `supabase/reset-test-stars.sql`.
2. Paste **PART 1** and run it. It only reads. Check the numbers: one row per test plan, and a TOTAL row. These are the star records and plan assignments that will be removed.
3. If the numbers look right, paste **PART 2** and run it.
4. Run PART 1 again. TOTAL should now be 0 and 0.

## Alternative (if Node is installed)

```
DATABASE_URL=... npx tsx scripts/reset-test-stars.ts --dry-run   # prints counts, changes nothing
DATABASE_URL=... npx tsx scripts/reset-test-stars.ts             # does the reset
```

Both ways do exactly the same thing.
