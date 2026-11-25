import { test, expect } from '@playwright/test';
import { CLASS, STUDENTS } from './fixtures/seed';

test('personal link lands on /pick the first time, and on / once a blob is chosen', async ({ page }) => {
  await page.goto(`/s/${STUDENTS.mina.secret}`);
  await expect(page).toHaveURL(/\/pick$/);
  await expect(page.getByText('Hi, Mina!')).toBeVisible();

  await page.goto(`/s/${STUDENTS.leo.secret}`);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Hi, Leo!')).toBeVisible();
});

test('unknown link shows the friendly problem screen with a way to /join', async ({ page }) => {
  await page.goto('/s/not-a-real-secret');
  await expect(page.getByRole('link', { name: /class code/i })).toBeVisible();
  await page.getByRole('link', { name: /class code/i }).click();
  await expect(page).toHaveURL(/\/join$/);
});

test('"Not you?" goes to /join; class code plus name sets the other kid', async ({ page }) => {
  await page.goto(`/s/${STUDENTS.mina.secret}`);
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await page.getByRole('button', { name: 'Not you?' }).click();
  await expect(page).toHaveURL(/\/join$/);

  // cleared: going home sends us back to /join
  await page.goto('/');
  await expect(page).toHaveURL(/\/join$/);

  const input = page.getByLabel(/class code/i);
  await input.fill('zzzzzz');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/couldn.t find that code/i)).toBeVisible();

  await input.fill(CLASS.code.toLowerCase());
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Leo' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Hi, Leo!')).toBeVisible();
});

test('/pick and / send a visitor with no cookie to /join', async ({ page }) => {
  await page.goto('/pick');
  await expect(page).toHaveURL(/\/join$/);
});

test('/join keeps characters typed before the page hydrates', async ({ page }) => {
  // Hold every script chunk for ~1.5s so the kid types into server-rendered HTML.
  await page.route('**/_next/static/**/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto('/join', { waitUntil: 'commit' });
  const input = page.getByLabel(/class code/i);
  await input.waitFor();
  await input.pressSequentially(CLASS.code.toLowerCase());
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled({ timeout: 15_000 });
  await expect(input).toHaveValue(CLASS.code);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leo' })).toBeVisible();
});

test('"Different code" keeps the code visible and Next stays in step with the field', async ({ page }) => {
  await page.goto('/join');
  const input = page.getByLabel(/class code/i);
  await input.fill(CLASS.code);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Leo' }).waitFor();
  await page.getByRole('button', { name: 'Different code' }).click();
  await expect(input).toHaveValue(CLASS.code);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await input.fill('AB');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
});
