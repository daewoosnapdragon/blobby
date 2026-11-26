import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { STUDENTS, PLAN, E2E_DATABASE_URL } from './fixtures/seed';
import { isPracticeBonus } from '../../src/lib/bonus';
import { seoulDate } from '../../src/lib/dates';

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
test.afterAll(async () => {
  await sql.end();
});

const leo = STUDENTS.leo;
// The open week has four questions; a set holds all of them, in random order.
const RIGHT = ['I walked to school.', 'ate', 'She went home.', 'They played tag.'];
const WRONG = ['I walk to school.', 'eat', 'She goed home.', 'They playing tag.'];

const starPill = (page: Page, n: number) => page.getByLabel(`${n} stars`, { exact: true });
const buttonFor = (page: Page, names: string[]) => page.getByRole('button', { name: new RegExp(`^(${names.join('|')})$`) });
const rightCard = (page: Page) => page.locator('[role="status"] [data-result="right"]');
const wrongCard = (page: Page) => page.locator('[role="status"] [data-result="wrong"]');
const STAR_NOTE = /\+\d+ stars?/;
const Q = PLAN.questions;
const QUESTION_IDS = [Q.q1.id, Q.q2.id, Q.q3.id, Q.q4.id];

/**
 * Waits for question `n` of 4, then whether it carries the Bonus! tag, checked against the server's rule for
 * today (the question is found by which right answer it shows). The set is random per load, so tests read it here.
 */
async function bonusAt(page: Page, n: number): Promise<boolean> {
  await expect(page.getByRole('progressbar', { name: `Question ${n} of 4` })).toBeVisible();
  const shown: number[] = [];
  for (const [i, name] of RIGHT.entries()) if ((await page.getByRole('button', { name, exact: true }).count()) > 0) shown.push(i);
  expect(shown).toHaveLength(1);
  const qid = QUESTION_IDS[shown[0]];
  const bonus = await page.getByText('Bonus!', { exact: true }).isVisible();
  expect(bonus).toBe(isPracticeBonus(leo.id, seoulDate(new Date()), qid));
  return bonus;
}
const note = (bonus: boolean) => (bonus ? '+2 stars' : '+1 star');

async function leoStars() {
  const [{ n }] = await sql<{ n: number }[]>`select coalesce(sum(amount),0)::int as n from wp_star_events where student_id = ${leo.id}`;
  return n;
}

test.beforeEach(async () => {
  await sql`delete from wp_star_events where student_id = ${leo.id} and reason = 'free_correct'`;
  await sql`delete from wp_attempts where student_id = ${leo.id} and context = 'free'`;
});

test('free practice: first-try right earns +1 star (+2 on a bonus question), retries earn none, summary counts the server', async ({ page }) => {
  await page.goto(`/s/${leo.secret}`);
  const base = await leoStars();
  await expect(starPill(page, base)).toBeVisible();

  await page.getByRole('link', { name: /Free practice/ }).click();
  await expect(page).toHaveURL(/\/practice$/);
  let earned = 0;

  // question 1: right first try -> "+1 star" (or "+2 stars" on a bonus question) and the pill goes up by that much
  const b1 = await bonusAt(page, 1);
  await buttonFor(page, RIGHT).first().click();
  await expect(rightCard(page)).toBeVisible();
  await expect(rightCard(page)).toContainText(note(b1));
  earned += b1 ? 2 : 1;
  await expect(starPill(page, base + earned)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // question 2: wrong first, then right -> no star and no star note, bonus or not
  await bonusAt(page, 2);
  await buttonFor(page, WRONG).first().click();
  await expect(wrongCard(page)).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await buttonFor(page, RIGHT).first().click();
  await expect(rightCard(page)).toBeVisible();
  await expect(rightCard(page)).not.toContainText(STAR_NOTE);
  await expect(starPill(page, base + earned)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // questions 3 and 4: right first try
  for (const n of [3, 4]) {
    const bonus = await bonusAt(page, n);
    await buttonFor(page, RIGHT).first().click();
    await expect(rightCard(page)).toContainText(note(bonus));
    earned += bonus ? 2 : 1;
    await expect(starPill(page, base + earned)).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  await expect(page.getByRole('heading', { name: 'Practice done!' })).toBeVisible();
  await expect(page.getByText(`You earned ${earned} stars`)).toBeVisible();
  await expect(starPill(page, base + earned)).toBeVisible();

  // the database agrees: 3 free_correct events worth `earned`, 4 free attempts (retries are not stored)
  const [{ ev, sum }] = await sql<{ ev: number; sum: number }[]>`
    select count(*)::int as ev, coalesce(sum(amount),0)::int as sum from wp_star_events where student_id = ${leo.id} and reason = 'free_correct'`;
  const [{ at }] = await sql<{ at: number }[]>`select count(*)::int as at from wp_attempts where student_id = ${leo.id} and context = 'free'`;
  expect(ev).toBe(3);
  expect(sum).toBe(earned);
  expect(at).toBe(4);

  // practice again: a new set starts
  await page.getByRole('button', { name: 'Practice again' }).click();
  await expect(page.getByRole('progressbar', { name: 'Question 1 of 4' })).toBeVisible();
  await page.getByRole('link', { name: 'Close practice' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('three right first try in a row: the blob sparkles on the third', async ({ page }) => {
  await page.goto(`/s/${leo.secret}`);
  await page.goto('/practice');
  for (const n of [1, 2, 3]) {
    await expect(page.getByRole('progressbar', { name: `Question ${n} of 4` })).toBeVisible();
    await buttonFor(page, RIGHT).first().click();
    await expect(rightCard(page)).toBeVisible();
    if (n < 3) await expect(page.getByTestId('sparkles')).toHaveCount(0);
    else await expect(page.getByTestId('sparkles')).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
});

test('a kid who earned nothing sees "Nice practice!", never +0', async ({ page }) => {
  await page.goto(`/s/${leo.secret}`);
  await page.goto('/practice');
  for (let i = 0; i < 4; i++) {
    await buttonFor(page, WRONG).first().click();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await buttonFor(page, RIGHT).first().click();
    await expect(rightCard(page)).toBeVisible();
    await expect(rightCard(page)).not.toContainText(STAR_NOTE);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Practice done!' })).toBeVisible();
  await expect(page.getByText('Nice practice!')).toBeVisible();
  await expect(page.getByText(/\+0|earned 0/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
});

test('before any week opens, home shows a calm disabled card and /practice is friendly', async ({ page }) => {
  await sql`update wp_weeks set opens_on = '2099-02-01' where id = ${PLAN.weeks.open.id}`;
  try {
    await page.goto(`/s/${leo.secret}`);
    await expect(page.getByTestId('free-off')).toContainText('Opens when your first week does');
    await expect(page.getByRole('link', { name: /Free practice/ })).toHaveCount(0);
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Nothing to practice yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to my plan' })).toBeVisible();
  } finally {
    await sql`update wp_weeks set opens_on = '2026-01-01' where id = ${PLAN.weeks.open.id}`;
  }
});

test('a right answer that could not be saved offers a tap to try again, with the same attempt id', async ({ page }) => {
  await page.goto(`/s/${leo.secret}`);
  const base = await leoStars();
  await page.goto('/practice');
  const bonus = await bonusAt(page, 1);
  const pays = bonus ? 2 : 1;

  let offline = true;
  const ids: string[] = [];
  await page.route('**/api/attempt', async (route) => {
    ids.push(JSON.parse(route.request().postData() ?? '{}').clientAttemptId);
    if (offline) await route.abort('internetdisconnected');
    else await route.continue();
  });

  await buttonFor(page, RIGHT).first().click();
  await expect(rightCard(page)).toContainText(note(bonus));
  const retry = page.getByRole('button', { name: 'Couldn’t save that one. Tap to try again' });
  await expect(retry).toBeVisible({ timeout: 10_000 }); // after the automatic retries
  expect(ids).toHaveLength(4);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from wp_attempts where student_id = ${leo.id} and context = 'free'`;
  expect(n).toBe(0);

  // it never blocks moving on
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Question 2 of 4' })).toBeVisible();

  offline = false;
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(starPill(page, base + pays)).toBeVisible();
  expect(new Set(ids).size).toBe(1); // every send, including the tap, used one clientAttemptId
  expect(await leoStars()).toBe(base + pays);
});
