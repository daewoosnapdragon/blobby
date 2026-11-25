import { test, expect } from '@playwright/test';
import { CLASS, STUDENTS } from './fixtures/seed';

// The e2e server has no Supabase or TEACHER_EMAILS configured, so teacher auth must fail closed.
test.describe('teacher side fails closed without a teacher session', () => {
  for (const path of ['/teacher', `/teacher/class/${CLASS.id}`, `/teacher/student/${STUDENTS.mina.id}`]) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/teacher\/login$/);
      await expect(page.getByRole('heading', { name: 'Blobby teacher' })).toBeVisible();
      await expect(page).toHaveTitle('Sign in · Blobby teacher');
    });
  }

  test('login gives the same neutral answer for any email', async ({ page }) => {
    for (const email of ['stranger@example.com', 'kyla@example.com']) {
      await page.goto('/teacher/login');
      await page.getByLabel('Email').fill(email);
      await page.getByRole('button', { name: 'Email me a link' }).click();
      await expect(page).toHaveURL(/sent=1/);
      await expect(page.getByRole('status')).toHaveText('If that email can sign in, a link is on its way. Check your email.');
    }
  });

  test('a bad callback code goes back to login', async ({ page }) => {
    await page.goto('/teacher/auth/callback?code=nope');
    await expect(page).toHaveURL(/\/teacher\/login/);
  });

  test('kid pages are untouched by the teacher middleware', async ({ page }) => {
    await page.goto('/join');
    await expect(page).toHaveURL(/\/join$/);
  });
});
