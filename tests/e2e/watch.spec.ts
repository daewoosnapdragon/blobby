import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { STUDENTS, PLAN, E2E_DATABASE_URL } from './fixtures/seed';

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const LESSON = '00000000-0000-4000-8000-00000000e5a1';
const QUESTION = '00000000-0000-4000-8000-00000000e5a2';
const SHOTS = process.env.SHOTS_DIR;

test.use({ deviceScaleFactor: 2 });

test.beforeAll(async () => {
  await sql`insert into wp_lessons (id, week_id, position, title) values (${LESSON}, ${PLAN.weeks.open.id}, 50, 'Watch test')`;
  await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio) values (${QUESTION}, ${LESSON}, 1, 'watch_answer',
    ${sql.json({ youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'pick_one', prompt: 'Which one is right?', choices: ['She goed home.', 'She went home.'], answer: 1 }] } as never)}, ${sql.json({} as never)})`;
});
test.afterAll(async () => {
  await sql`delete from wp_attempts where question_id = ${QUESTION}`;
  await sql`delete from wp_questions where id = ${QUESTION}`;
  await sql`delete from wp_lessons where id = ${LESSON}`;
  await sql.end();
});

for (const vp of [{ name: '390x844', width: 390, height: 844 }, { name: '1280x800', width: 1280, height: 800 }]) {
  test(`video step with YouTube blocked: Skip video appears and the question still plays (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.route(/youtube/, (r) => r.abort());
    await page.goto(`/s/${STUDENTS.leo.secret}`);
    await page.goto(`/lesson/${LESSON}`);
    await expect(page.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hear it' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Skip video' })).toBeVisible({ timeout: 12_000 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/video-skip-${vp.name}.png` });
    // the page never scrolls sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Skip video' }).click();
    await page.getByRole('button', { name: 'She went home.', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('That’s it!');
  });
}
