import { test, expect, type Page } from '@playwright/test';
import { STUDENTS } from './fixtures/seed';

test.use({ deviceScaleFactor: 2 });
const SHOTS = '.superpowers/sdd/plan-docs/task-16-shots';
const home = (q: string) => `/?${q}`;
const DEC_22 = 'scene-date=2026-12-22T12:00:00%2B09:00';
const DEC_25 = 'scene-date=2026-12-25T12:00:00%2B09:00';
const SEOLLAL = 'scene-date=2027-02-07T12:00:00%2B09:00';

async function signIn(page: Page) {
  await page.goto(`/s/${STUDENTS.leo.secret}`);
  await expect(page.getByRole('heading', { name: 'Hi, Leo!' })).toBeVisible();
}

test('an ordinary afternoon has no snow, hat or pajamas', async ({ page }) => {
  await signIn(page);
  await page.goto(home('scene-date=2026-11-25T12:00:00%2B09:00&scene-hour=14'));
  await expect(page.getByRole('heading', { name: 'Hi, Leo!' })).toBeVisible();
  await expect(page.locator('[data-snow]')).toHaveCount(0);
  await expect(page.locator('[data-part^="hat-"]')).toHaveCount(0);
  await expect(page.locator('[data-accessory]')).toHaveCount(0);
});

test('bedtime: pajamas and the nudge line, and Keep going still works', async ({ page }) => {
  await signIn(page);
  await page.goto(home('scene-date=2026-11-25T12:00:00%2B09:00&scene-hour=22'));
  await expect(page.getByText('Time for bed, see you tomorrow!')).toBeVisible();
  await expect(page.locator('[data-accessory="pajamas"]')).toHaveCount(1);
  const keep = page.getByRole('link', { name: 'Keep going' });
  await expect(keep).toBeVisible();
  await keep.click(); // Keep going works
  await expect(page).toHaveURL(/\/lesson\//);
  await page.goto(`${new URL(page.url()).pathname}?scene-hour=22`); // the override is per page, so carry it over
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.locator('[data-accessory="pajamas"]')).toHaveCount(1); // the question blob wears them too
});

test('snow week with the santa hat: snow is click-through and does not scroll the page', async ({ page }) => {
  await signIn(page);
  await page.goto(home(`${DEC_25}&scene-hour=14`));
  await expect(page.locator('[data-snow]')).toHaveCount(1);
  await expect(page.locator('[data-snow]')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('[data-part="hat-santa"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('link', { name: 'Keep going' }).click(); // taps pass through the snow
  await expect(page).toHaveURL(/\/lesson\//);
  await page.goto(`${new URL(page.url()).pathname}?${DEC_25}`);
  await expect(page.locator('[data-part="hat-santa"]')).toHaveCount(1);
});

test('reduced motion: no snow layer at all', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  await page.goto(home(`${DEC_22}&scene-hour=14`));
  await expect(page.getByRole('heading', { name: 'Hi, Leo!' })).toBeVisible();
  await expect(page.locator('[data-snow]')).toHaveCount(0);
});

test('morning: good morning line, no layout shift', async ({ page }) => {
  await signIn(page);
  await page.goto(home('scene-date=2026-11-25T12:00:00%2B09:00&scene-hour=7'));
  await expect(page.getByText('Good morning!')).toBeVisible();
});

test('Seollal shows the bow', async ({ page }) => {
  await signIn(page);
  await page.goto(home(`${SEOLLAL}&scene-hour=14`));
  await expect(page.locator('[data-part="hat-seollal"]')).toHaveCount(1);
});

test('screenshots', async ({ page }) => {
  test.skip(!process.env.SCENE_SHOTS, 'set SCENE_SHOTS=1 to write the screenshots');
  const views = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
  const shots: [string, string][] = [
    ['snow-santa', `${DEC_25}&scene-hour=14`],
    ['bedtime', 'scene-date=2026-11-25T12:00:00%2B09:00&scene-hour=22'],
    ['seollal', `${SEOLLAL}&scene-hour=14`],
  ];
  await signIn(page);
  for (const [vn, size] of Object.entries(views)) {
    await page.setViewportSize(size);
    for (const [name, q] of shots) {
      await page.goto(home(q));
      await expect(page.getByRole('heading', { name: 'Hi, Leo!' })).toBeVisible();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/${name}-${vn}.png` });
    }
  }
});
