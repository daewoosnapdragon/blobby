import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { STUDENTS, PLAN, E2E_DATABASE_URL } from './fixtures/seed';

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

async function leoStars() {
  const [{ n }] = await sql<{ n: number }[]>`select coalesce(sum(amount),0)::int as n from wp_star_events where student_id = ${leo.id}`;
  return n;
}

test.beforeEach(async () => {
  await sql`delete from wp_star_events where student_id = ${leo.id} and reason = 'free_correct'`;
  await sql`delete from wp_attempts where student_id = ${leo.id} and context = 'free'`;
});

test('free practice: first-try right earns +1 star, retries earn none, summary counts the server', async ({ page }) => {
  await page.goto(`/s/${leo.secret}`);
  const base = await leoStars();
  await expect(starPill(page, base)).toBeVisible();

  await page.getByRole('link', { name: /Free practice/ }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole('progressbar', { name: 'Question 1 of 4' })).toBeVisible();

  // question 1: right first try -> "+1 star" and the pill goes up
  await buttonFor(page, RIGHT).first().click();
  await expect(page.getByRole('status')).toContainText('That’s it!');
  await expect(page.getByRole('status')).toContainText('+1 star');
  await expect(starPill(page, base + 1)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // question 2: wrong first, then right -> no star, no "+1 star"
  await buttonFor(page, WRONG).first().click();
  await expect(page.getByRole('status')).toContainText('Almost!');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await buttonFor(page, RIGHT).first().click();
  await expect(page.getByRole('status')).toContainText('That’s it!');
  await expect(page.getByRole('status')).not.toContainText('+1 star');
  await expect(starPill(page, base + 1)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // questions 3 and 4: right first try
  for (let i = 0; i < 2; i++) {
    await buttonFor(page, RIGHT).first().click();
    await expect(page.getByRole('status')).toContainText('+1 star');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  await expect(page.getByRole('heading', { name: 'Practice done!' })).toBeVisible();
  await expect(page.getByText('You earned 3 stars')).toBeVisible();
  await expect(starPill(page, base + 3)).toBeVisible();

  // the database agrees: 3 free_correct events, 4 free attempts (retries are not stored)
  const [{ ev }] = await sql<{ ev: number }[]>`select count(*)::int as ev from wp_star_events where student_id = ${leo.id} and reason = 'free_correct'`;
  const [{ at }] = await sql<{ at: number }[]>`select count(*)::int as at from wp_attempts where student_id = ${leo.id} and context = 'free'`;
  expect(ev).toBe(3);
  expect(at).toBe(4);

  // practice again: a new set starts
  await page.getByRole('button', { name: 'Practice again' }).click();
  await expect(page.getByRole('progressbar', { name: 'Question 1 of 4' })).toBeVisible();
  await page.getByRole('link', { name: 'Close practice' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('a kid who earned nothing sees "Nice practice!", never +0', async ({ page }) => {
  await page.goto(`/s/${leo.secret}`);
  await page.goto('/practice');
  for (let i = 0; i < 4; i++) {
    await buttonFor(page, WRONG).first().click();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await buttonFor(page, RIGHT).first().click();
    await expect(page.getByRole('status')).not.toContainText('+1 star');
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
