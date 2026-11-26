import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { STUDENTS, PLAN, NEW_TYPES_LESSON as LESSON, E2E_DATABASE_URL } from './fixtures/seed';

// Mina (no blob yet) plays a lesson with one question of each newer type. The lesson is added to the open week
// here and everything it leaves behind is removed afterwards, so later specs see the seed as it was.
const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const mina = STUDENTS.mina;
const QIDS = LESSON.questions.map((q) => q.id);
let daysBefore: string[] = [];
let runsBefore: string[] = [];

test.beforeAll(async () => {
  await sql`update wp_students set blob_color = null where id = ${mina.id}`;
  daysBefore = (await sql<{ day: string }[]>`select day::text as day from wp_practice_days where student_id = ${mina.id}`).map((r) => r.day);
  runsBefore = (await sql<{ run_id: string }[]>`select run_id from wp_track_runs where student_id = ${mina.id}`).map((r) => r.run_id);
  await sql`insert into wp_lessons (id, week_id, position, title) values (${LESSON.id}, ${PLAN.weeks.open.id}, ${LESSON.position}, ${LESSON.title})`;
  for (const [i, q] of LESSON.questions.entries()) {
    await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio)
      values (${q.id}, ${LESSON.id}, ${i + 1}, ${q.type}, ${sql.json(q.payload as never)}, ${sql.json({} as never)})`;
  }
});

test.afterAll(async () => {
  await sql`delete from wp_attempts where question_id = any(${QIDS}::uuid[])`;
  await sql`delete from wp_lesson_completions where lesson_id = ${LESSON.id}`;
  await sql`delete from wp_star_events where ref_id = ${LESSON.id}`;
  await sql`delete from wp_review_picks where lesson_id = ${LESSON.id}`;
  await sql`delete from wp_track_runs where student_id = ${mina.id} and not (run_id = any(${runsBefore}::uuid[]))`;
  await sql`delete from wp_practice_days where student_id = ${mina.id} and not (day::text = any(${daysBefore}::text[]))`;
  await sql`delete from wp_questions where lesson_id = ${LESSON.id}`;
  await sql`delete from wp_lessons where id = ${LESSON.id}`;
  await sql`update wp_students set blob_color = null where id = ${mina.id}`;
  await sql.end();
});

const TOTAL = LESSON.questions.length;
const rightCard = (page: Page) => page.locator('[role="status"] [data-result="right"]');
const wrongCard = (page: Page) => page.locator('[role="status"] [data-result="wrong"]');
const bonusTag = (page: Page) => page.getByText('Bonus!', { exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tile = (page: Page, side: 'left' | 'right', text: string) =>
  page.locator(`button[data-side="${side}"]`).filter({ hasText: new RegExp(`^${text}$`) });

/** Waits for question `n` with its type tag, then says whether it carries the Bonus! tag. */
async function at(page: Page, n: number, tag: string): Promise<boolean> {
  await expect(page.getByRole('progressbar', { name: `Question ${n} of ${TOTAL}` })).toBeVisible();
  await expect(page.getByText(tag, { exact: true })).toBeVisible();
  return bonusTag(page).isVisible();
}
async function rightThenNext(page: Page) {
  await expect(rightCard(page)).toBeVisible();
  await button(page, 'Next').click();
}

async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v) || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
}

test('Mina plays yes or no, odd one out, picture first, tap them all and match pairs', async ({ page }) => {
  await page.goto(`/s/${mina.secret}`);
  await expect(page).toHaveURL(/\/pick$/);
  await page.getByRole('radio', { name: 'Sunny' }).click();
  await page.getByRole('button', { name: 'That’s me!' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/lesson/${LESSON.id}`);
  const bonus: boolean[] = [];

  // right or wrong: the sentence is wrong, so No is right
  bonus.push(await at(page, 1, 'Yes or no'));
  await expect(page.getByText('She goed to the park.')).toBeVisible();
  await expect(button(page, 'Yes')).toBeVisible();
  await button(page, 'No').click();
  await rightThenNext(page);

  // odd one out
  bonus.push(await at(page, 2, 'Odd one out'));
  await button(page, 'run').click();
  await rightThenNext(page);

  // picture first: the frog shows at 160px
  bonus.push(await at(page, 3, 'Picture first'));
  const frog = page.locator('img[alt="frog"]');
  await expect(frog).toBeVisible();
  expect(Math.round((await frog.boundingBox())!.width)).toBe(160);
  await button(page, 'a frog').click();
  await rightThenNext(page);

  // tap them all: two nouns, then Check
  bonus.push(await at(page, 4, 'Tap them all'));
  await expect(button(page, 'Check')).toHaveCount(0);
  await button(page, 'dog').click();
  await expect(button(page, 'dog')).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'cake').click();
  await button(page, 'Check').click();
  await rightThenNext(page);

  // match pairs: swap two pairs on purpose, Check, Try again keeps the board, fix the two, Check
  bonus.push(await at(page, 5, 'Match pairs'));
  for (const [l, r] of [['run', 'went'], ['go', 'ran'], ['eat', 'ate']]) {
    await tile(page, 'left', l).click();
    await tile(page, 'right', r).click();
  }
  await button(page, 'Check').click();
  await expect(wrongCard(page)).toBeVisible();
  await expect(tile(page, 'left', 'run')).toHaveAttribute('data-mark', 'wrong');
  await expect(tile(page, 'left', 'eat')).not.toHaveAttribute('data-mark', 'wrong');
  await button(page, 'Try again').click();
  await expect(tile(page, 'left', 'eat')).toHaveAttribute('data-pair', '2');
  await tile(page, 'left', 'run').click(); // unpair
  await tile(page, 'left', 'go').click(); // unpair
  await tile(page, 'left', 'run').click();
  await tile(page, 'right', 'ran').click();
  await tile(page, 'left', 'go').click();
  await tile(page, 'right', 'went').click();
  await button(page, 'Check').click();
  await expect(rightCard(page)).toBeVisible();
  await expect(rightCard(page)).not.toContainText(/\+\d+ stars?/); // not a first-try right, so never bonus stars
  await button(page, 'Next').click();

  // done: one bonus question; it pays +2 unless it was match pairs (missed first)
  expect(bonus.filter(Boolean)).toHaveLength(1);
  await expect(page.getByText('+10 stars')).toBeVisible();
  if (bonus[4]) await expect(page.getByText(/bonus stars/)).toHaveCount(0);
  else await expect(page.getByText('+2 bonus stars')).toBeVisible();
  const recap = page.locator('[data-testid="recap"] li');
  await expect(recap).toHaveText(['You made 3 pairs', 'You tapped 2 words', 'You checked 1 sentence']);

  // only first tries are stored: four right, match pairs missed
  const rows = await eventually(
    () => sql<{ question_id: string; correct: boolean }[]>`
      select question_id, correct from wp_attempts where student_id = ${mina.id} and question_id = any(${QIDS}::uuid[]) order by created_at`,
    (r) => r.length >= TOTAL,
  );
  expect(rows.map((r) => [r.question_id, r.correct])).toEqual(QIDS.map((id, i) => [id, i < 4]));
});
