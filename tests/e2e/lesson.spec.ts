import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { CLASS, STUDENTS, PLAN, E2E_DATABASE_URL } from './fixtures/seed';

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
test.afterAll(async () => {
  await sql.end();
});

const { lessons: L, questions: Q, weeks: W } = PLAN;

const starPill = (page: Page, n: number) => page.getByLabel(`${n} stars`, { exact: true });

/** Answers the current question by tapping `choice`, expects the right card, then taps Next. */
async function answerRight(page: Page, choice: string) {
  await page.getByRole('button', { name: choice, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('That’s it!');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
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

test('pick a blob, finish a lesson (+10), finish the week (+30 this week), redo for practice', async ({ page }) => {
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
  await expect(page.getByRole('progressbar', { name: 'Question 1 of 2' })).toBeVisible();

  // Read-aloud is switched off for now (src/lib/features.ts): no Hear it, even though this question has an audio URL.
  // (With it on, the URL 404s and Hear it shows "Try again"; the unit tests cover that.)
  await expect(page.getByRole('button', { name: /hear it/i })).toHaveCount(0);

  // wrong first, then right: only the first try is stored
  await page.getByRole('button', { name: 'I walk to school.', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Almost!');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await answerRight(page, 'I walked to school.');
  await answerRight(page, 'ate');

  await expect(page.getByText('+10 stars')).toBeVisible();
  await expect(starPill(page, 10)).toBeVisible();
  const a = await eventually(() => attempts(jun.id), (r) => r.length >= 2);
  expect(a.map((r) => [r.question_id, r.correct, r.context])).toEqual([
    [Q.q1.id, false, 'lesson'],
    [Q.q2.id, true, 'lesson'],
  ]);

  await page.getByRole('link', { name: 'Back to my plan' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(starPill(page, 10)).toBeVisible();
  await expect(page.getByText('1 more lesson to finish the week')).toBeVisible();

  // the open week card leads to the week's lesson list
  await page.getByRole('link', { name: new RegExp(W.open.skill) }).last().click();
  await expect(page).toHaveURL(new RegExp(`/week/${W.open.id}$`));
  await page.getByRole('link', { name: new RegExp(L.two.title) }).click();
  await answerRight(page, 'She went home.');
  await answerRight(page, 'They played tag.');
  await expect(page.getByText('+10 stars')).toBeVisible();
  await expect(starPill(page, 30)).toBeVisible(); // lesson + week bonus

  // week done: lesson + lesson + bonus = 30 this week
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/week-done/${W.open.id}$`));
  await expect(page.getByRole('heading', { name: 'Week 1 done!' })).toBeVisible();
  await expect(page.getByTestId('week-stars')).toHaveText('+30');
  await expect(page.getByTestId('chest-total')).toHaveText('30');
  await expect(page.getByText('Opens when you’re back at school')).toBeVisible();
  const [{ n }] = await sql<{ n: number }[]>`select coalesce(sum(amount),0)::int as n from wp_star_events where student_id = ${jun.id}`;
  expect(n).toBe(30);

  // redo: no stars, "Nice practice!", and no second week-done
  await page.goto(`/lesson/${L.one.id}`);
  await answerRight(page, 'I walked to school.');
  await answerRight(page, 'ate');
  await expect(page.getByText('Nice practice!')).toBeVisible();
  await expect(page.getByText('+10 stars')).toHaveCount(0);
  await expect(starPill(page, 30)).toBeVisible();
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
