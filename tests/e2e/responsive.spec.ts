import { test, expect, type Page } from '@playwright/test';
import { STUDENTS, PLAN } from './fixtures/seed';

const WEEKS = Object.keys(PLAN.weeks).length; // 4

async function railMetrics(page: Page) {
  return page.getByTestId('week-rail').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    tiles: [...el.children].map((c) => { const r = c.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }),
    pageScrollWidth: document.documentElement.scrollWidth,
  }));
}

test('desktop (1280×800): home shows every week card, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/s/${STUDENTS.leo.secret}`);
  await expect(page.getByRole('heading', { name: 'Hi, Leo!' })).toBeVisible();
  const m = await railMetrics(page);
  expect(m.tiles).toHaveLength(WEEKS);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
  expect(m.pageScrollWidth).toBeLessThanOrEqual(1280);
  for (const t of m.tiles) {
    expect(t.left).toBeGreaterThanOrEqual(0);
    expect(t.right).toBeLessThanOrEqual(1280);
    expect(t.bottom).toBeLessThanOrEqual(800); // the whole plan fits on one desktop screen
  }
});

test('tablet (820×1180): all week cards visible without scrolling the rail', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`/s/${STUDENTS.leo.secret}`);
  const m = await railMetrics(page);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
  expect(m.pageScrollWidth).toBeLessThanOrEqual(820);
  for (const t of m.tiles) expect(t.right).toBeLessThanOrEqual(820);
});

test('phone (390×844): the rail scrolls sideways and the next card peeks in', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/s/${STUDENTS.leo.secret}`);
  const m = await railMetrics(page);
  expect(m.scrollWidth).toBeGreaterThan(m.clientWidth);
  expect(m.pageScrollWidth).toBeLessThanOrEqual(390);
  // the first card hidden past the right edge still shows a sliver (at least 16px)
  const cut = m.tiles.find((t) => t.right > 390)!;
  expect(cut).toBeDefined();
  expect(390 - cut.left).toBeGreaterThanOrEqual(16);
});

test('lesson player on desktop keeps the feedback near the answers', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/s/${STUDENTS.leo.secret}`);
  await page.goto(`/lesson/${PLAN.lessons.two.id}`);
  const last = page.getByRole('button', { name: 'She went home.', exact: true });
  await page.getByRole('button', { name: 'She goed home.', exact: true }).click();
  const fb = page.getByRole('status');
  await expect(fb).toContainText('Almost!');
  const a = (await last.boundingBox())!;
  const b = (await fb.boundingBox())!;
  expect(b.y - (a.y + a.height)).toBeLessThan(120);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});
