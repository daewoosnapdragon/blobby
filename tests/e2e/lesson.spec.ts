import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { CLASS, STUDENTS, PLAN, E2E_DATABASE_URL } from './fixtures/seed';

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
test.afterAll(async () => {
  await sql.end();
});

const { lessons: L, questions: Q, weeks: W } = PLAN;

const starPill = (page: Page, n: number) => page.getByLabel(`${n} stars`, { exact: true });
const rightCard = (page: Page) => page.locator('[role="status"] [data-result="right"]');
const wrongCard = (page: Page) => page.locator('[role="status"] [data-result="wrong"]');
// exact: a fill_blank bonus also starts its bubble with "Bonus!"; the tag is the element whose whole text is "Bonus!"
const bonusTag = (page: Page) => page.getByText('Bonus!', { exact: true });

/** Answers the current question by tapping `choice`, expects the right card, then taps Next. */
async function answerRight(page: Page, choice: string) {
  await page.getByRole('button', { name: choice, exact: true }).click();
  await expect(rightCard(page)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}

/** Waits for question `n` of `total`, then says whether it carries the Bonus! tag. */
async function bonusAt(page: Page, n: number, total: number): Promise<boolean> {
  await expect(page.getByRole('progressbar', { name: `Question ${n} of ${total}` })).toBeVisible();
  return bonusTag(page).isVisible();
}

async function attempts(studentId: string) {
  return sql<{ question_id: string; correct: boolean; context: string }[]>`
    select question_id, correct, context from wp_attempts where student_id = ${studentId} order by created_at`;
}

async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v) || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
}

test('pick a blob, finish a lesson (+10, +2 for a first-try right bonus question), finish the week, redo for practice', async ({ page }) => {
  const jun = STUDENTS.jun;
  await page.goto(`/s/${jun.secret}`);
  await expect(page).toHaveURL(/\/pick$/);
  await expect(page.getByText('Hi, Jun!')).toBeVisible();

  // pick Mint
  const mint = page.getByRole('radio', { name: 'Mint' });
  await mint.click();
  await expect(mint).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Sunny' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'That’s me!' }).click();
  await expect(page).toHaveURL(/\/$/);

  // home: the kid's blob is mint, stars 0, this week card, the rail
  await expect(page.getByRole('heading', { name: 'Hi, Jun!' })).toBeVisible();
  await expect(page.locator('[data-testid="me-blob"] [data-part="body"]')).toHaveAttribute('fill', '#B7E1D1');
  await expect(starPill(page, 0)).toBeVisible();
  await expect(page.getByText('2 more lessons to finish the week')).toBeVisible();
  await expect(page.getByText(/^Opens (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/)).toBeVisible();
  await expect(page.getByText('Opens Jan 5')).toBeVisible();
  await expect(page.getByText('Week 1 · you are here')).toBeVisible();
  // locked weeks are not links
  await expect(page.getByRole('link', { name: new RegExp(W.locked.skill) })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Free practice/ })).toHaveAttribute('href', '/practice');

  // lesson 1 via Keep going
  await page.getByRole('link', { name: 'Keep going' }).click();
  await expect(page).toHaveURL(new RegExp(`/lesson/${L.one.id}$`));
  const bonus1 = [await bonusAt(page, 1, 2)];

  // Review Focus #5: the audio 404s -> "Try again", and the question still works
  await page.getByRole('button', { name: 'Hear it' }).click();
  await expect(page.getByRole('button', { name: 'Try again to hear it' })).toBeVisible();

  // wrong first, then right: only the first try is stored (and a bonus question answered this way pays nothing)
  await page.getByRole('button', { name: 'I walk to school.', exact: true }).click();
  await expect(wrongCard(page)).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('button', { name: 'I walked to school.', exact: true }).click();
  await expect(rightCard(page)).toBeVisible();
  await expect(rightCard(page)).not.toContainText(/\+\d+ stars?/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  bonus1.push(await bonusAt(page, 2, 2));
  await page.getByRole('button', { name: 'ate', exact: true }).click();
  // in a lesson only the bonus question notes stars on its card, and only on a first-try right
  if (bonus1[1]) await expect(rightCard(page)).toContainText('+2 stars');
  else await expect(rightCard(page)).not.toContainText(/\+\d+ stars?/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // exactly one bonus question per lesson; it pays +2 only if its first try was right (q2 here, never q1)
  expect(bonus1.filter(Boolean)).toHaveLength(1);
  const one = 10 + (bonus1[1] ? 2 : 0);
  await expect(page.getByText('+10 stars')).toBeVisible();
  if (bonus1[1]) await expect(page.getByText('+2 bonus stars')).toBeVisible();
  else await expect(page.getByText(/bonus stars/)).toHaveCount(0);
  await expect(page.locator('[data-testid="recap"] li').first()).toBeVisible();
  await expect(starPill(page, one)).toBeVisible();
  const a = await eventually(() => attempts(jun.id), (r) => r.length >= 2);
  expect(a.map((r) => [r.question_id, r.correct, r.context])).toEqual([
    [Q.q1.id, false, 'lesson'],
    [Q.q2.id, true, 'lesson'],
  ]);
  const bonusRows = await sql<{ amount: number; ref_id: string }[]>`
    select amount, ref_id from wp_star_events where student_id = ${jun.id} and reason = 'lesson_bonus'`;
  expect(bonusRows.map((r) => [r.amount, r.ref_id])).toEqual(bonus1[1] ? [[2, L.one.id]] : []);

  await page.getByRole('link', { name: 'Back to my plan' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(starPill(page, one)).toBeVisible();
  await expect(page.getByText('1 more lesson to finish the week')).toBeVisible();

  // the open week card leads to the week's lesson list
  await page.getByRole('link', { name: new RegExp(W.open.skill) }).last().click();
  await expect(page).toHaveURL(new RegExp(`/week/${W.open.id}$`));
  await page.getByRole('link', { name: new RegExp(L.two.title) }).click();
  const bonus2: boolean[] = [];
  for (const [i, choice] of ['She went home.', 'They played tag.'].entries()) {
    bonus2.push(await bonusAt(page, i + 1, 2));
    await page.getByRole('button', { name: choice, exact: true }).click();
    if (bonus2[i]) await expect(rightCard(page)).toContainText('+2 stars');
    else await expect(rightCard(page)).not.toContainText(/\+\d+ stars?/);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  // all right first try: the bonus question pays +2
  expect(bonus2.filter(Boolean)).toHaveLength(1);
  await expect(page.getByText('+10 stars')).toBeVisible();
  await expect(page.getByText('+2 bonus stars')).toBeVisible();
  await expect(page.locator('[data-testid="recap"] li').first()).toBeVisible();
  const week = one + 12 + 10; // lesson one, lesson two + its bonus question, the week bonus
  await expect(starPill(page, week)).toBeVisible();

  // week done: both lessons, their bonus questions and the week bonus
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/week-done/${W.open.id}$`));
  await expect(page.getByRole('heading', { name: 'Week 1 done!' })).toBeVisible();
  await expect(page.getByTestId('week-stars')).toHaveText(`+${week}`);
  await expect(page.getByTestId('chest-total')).toHaveText(String(week));
  await expect(page.getByText('Opens when you’re back at school')).toBeVisible();
  const [{ n }] = await sql<{ n: number }[]>`select coalesce(sum(amount),0)::int as n from wp_star_events where student_id = ${jun.id}`;
  expect(n).toBe(week);

  // redo: no stars (not even for the bonus question), "Nice practice!", and no second week-done
  await page.goto(`/lesson/${L.one.id}`);
  const redo = [await bonusAt(page, 1, 2)];
  await answerRight(page, 'I walked to school.');
  redo.push(await bonusAt(page, 2, 2));
  await answerRight(page, 'ate');
  expect(redo.filter(Boolean)).toHaveLength(1);
  await expect(page.getByText('Nice practice!')).toBeVisible();
  await expect(page.getByText('+10 stars')).toHaveCount(0);
  await expect(page.getByText(/bonus stars/)).toHaveCount(0);
  await expect(starPill(page, week)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to my plan' })).toBeVisible();
});

test('Review Focus #2: after "Not you?" in another tab, an open lesson writes to the new kid', async ({ context }) => {
  const [mina, leo] = [STUDENTS.mina, STUDENTS.leo];
  const tab1 = await context.newPage();
  await tab1.goto(`/s/${mina.secret}`);
  await tab1.goto(`/lesson/${L.one.id}`);
  await expect(tab1.getByRole('progressbar', { name: 'Question 1 of 2' })).toBeVisible();

  const tab2 = await context.newPage();
  await tab2.goto('/pick');
  await expect(tab2.getByText('Hi, Mina!')).toBeVisible();
  await tab2.getByRole('button', { name: 'Not you?' }).click();
  await expect(tab2).toHaveURL(/\/join$/);
  await tab2.getByLabel(/class code/i).fill(CLASS.code);
  await tab2.getByRole('button', { name: 'Next', exact: true }).click();
  await tab2.getByRole('button', { name: 'Leo' }).click();
  await expect(tab2.getByRole('heading', { name: 'Hi, Leo!' })).toBeVisible();

  // tab 1 was opened as Mina; its answer must be stored for Leo
  await answerRight(tab1, 'I walked to school.');
  const leoRows = await eventually(() => attempts(leo.id), (r) => r.length >= 1);
  expect(leoRows.map((r) => r.question_id)).toEqual([Q.q1.id]);
  expect(await attempts(mina.id)).toEqual([]);

  await answerRight(tab1, 'ate');
  await expect(tab1.getByText('Nice work, Leo!')).toBeVisible();
  await expect(tab1.getByText('+10 stars')).toBeVisible(); // saved, and first time for Leo
  const done = await sql`select student_id from wp_lesson_completions where lesson_id = ${L.one.id} and student_id in (${mina.id}, ${leo.id})`;
  expect(done.map((r) => r.student_id)).toEqual([leo.id]);
  await tab1.getByRole('link', { name: 'Back to my plan' }).click();
  await expect(tab1.getByRole('heading', { name: 'Hi, Leo!' })).toBeVisible();
});

test('a lesson tab whose kid signed out shows "who are you?" with a way to /join', async ({ page, context }) => {
  await page.goto(`/s/${STUDENTS.mina.secret}`);
  await page.goto(`/lesson/${L.two.id}`);
  await expect(page.getByRole('progressbar', { name: 'Question 1 of 2' })).toBeVisible();
  await context.clearCookies();
  await page.getByRole('button', { name: 'She went home.', exact: true }).click();
  await expect(page.getByRole('heading', { name: /who.s practicing/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find my name' })).toHaveAttribute('href', '/join');
});

test('locked lessons and weeks show a friendly screen, not a crash', async ({ page }) => {
  await page.goto(`/s/${STUDENTS.leo.secret}`);
  for (const path of [`/lesson/${L.locked.id}`, `/week/${W.locked.id}`, `/week-done/${W.final.id}`, '/lesson/not-a-uuid']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'This isn’t open yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to my plan' })).toHaveAttribute('href', '/');
  }
});
