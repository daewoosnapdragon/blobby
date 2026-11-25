import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { STUDENTS, E2E_DATABASE_URL } from './fixtures/seed';
import { seoulDate } from '../../src/lib/dates';

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
test.afterAll(async () => {
  await sql.end();
});

const leo = STUDENTS.leo;
const RIGHT = ['I walked to school.', 'ate', 'She went home.', 'They played tag.'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

test('answering a question stamps today on /stamps, in the kid’s color', async ({ page }) => {
  await sql`delete from wp_practice_days where student_id = ${leo.id}`;
  await page.goto(`/s/${leo.secret}`);
  await page.getByRole('link', { name: /Free practice/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Question 1 of 4' })).toBeVisible();
  // any answer counts as practicing; a wrong first try is fine
  await page.getByRole('button', { name: new RegExp(`^(${RIGHT.join('|')})$`) }).first().click();
  await expect(page.getByRole('status')).toContainText('That’s it!');
  await expect.poll(async () => (await sql`select 1 from wp_practice_days where student_id = ${leo.id}`).length).toBe(1);

  await page.goto('/');
  await page.getByRole('link', { name: 'My stamps' }).click();
  await expect(page).toHaveURL(/\/stamps$/);
  const today = seoulDate(new Date());
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8));
  const cell = page.getByLabel(`${MONTHS[m - 1]} ${d}, practiced`);
  await expect(cell).toBeVisible();
  await expect(cell).toHaveAttribute('aria-current', 'date');
  await expect(cell.locator('[data-part="body"]')).toHaveAttribute('fill', '#B7E1D1');
  await expect(page.getByTestId('stamp-summary')).toHaveText('You practiced 1 day this month');
  // no going past the current month
  await expect(page.getByRole('link', { name: 'Next month' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous month' }).click();
  await expect(page.getByTestId('stamp-summary')).toContainText('Your first stamp is waiting');
  await expect(page.getByRole('link', { name: 'Next month' })).toBeVisible();
});
