import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { CLASS, STUDENTS, PLAN, E2E_DATABASE_URL } from './fixtures/seed';

// Jun (no blob yet) gets a review skill with two bank questions; lesson one's class questions are tagged was-were.
const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const jun = STUDENTS.jun;
const BANK = ['00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000b102'];

test.beforeAll(async () => {
  await sql`update wp_students set blob_color = 'sky' where id = ${jun.id}`;
  await sql`update wp_questions set skill = 'was-were' where id in (${PLAN.questions.q1.id}, ${PLAN.questions.q2.id})`;
  for (const [i, id] of BANK.entries()) {
    await sql`insert into wp_questions (id, bank_grade, skill, position, type, payload) values (${id}, ${CLASS.grade}, 'past-tense', ${i + 1}, 'pick_one',
      ${sql.json({ prompt: `Past tense ${i + 1}: which is right?`, choices: ['He went home.', 'He goed home.'], answer: 0 } as never)}) on conflict do nothing`;
  }
  await sql`insert into wp_student_skills (student_id, skill, source, state) values (${jun.id}, 'past-tense', 'pretest', 'active') on conflict do nothing`;
});
test.afterAll(async () => {
  await sql`delete from wp_track_runs where student_id = ${jun.id}`;
  await sql`delete from wp_star_events where student_id = ${jun.id}`;
  await sql`delete from wp_lesson_completions where student_id = ${jun.id}`;
  await sql`delete from wp_attempts where student_id = ${jun.id}`;
  await sql`delete from wp_student_skills where student_id = ${jun.id}`;
  await sql`delete from wp_questions where id = any(${BANK}::uuid[])`;
  await sql`update wp_questions set skill = null where id in (${PLAN.questions.q1.id}, ${PLAN.questions.q2.id})`;
  await sql`update wp_students set blob_color = null where id = ${jun.id}`;
  await sql.end();
});

test('a lesson mixes in "Just for you" questions; misses show Tricky today with Practice again', async ({ page }) => {
  await page.goto(`/s/${jun.secret}`);
  await page.goto(`/lesson/${PLAN.lessons.one.id}`);

  const wrongThenRight = async (wrong: string, right: string) => {
    await page.getByRole('button', { name: wrong, exact: true }).click();
    await expect(page.locator('[role="status"] [data-result="wrong"]')).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('button', { name: right, exact: true }).click();
    await page.getByRole('button', { name: /^(Next|Finish)/ }).click();
  };
  // the two class questions (was-were), each wrong first
  await wrongThenRight('I walk to school.', 'I walked to school.');
  await wrongThenRight('eat', 'ate');

  // then the two review questions, marked for this kid
  for (let i = 0; i < 2; i++) {
    await expect(page.getByText('Just for you')).toBeVisible();
    await page.getByRole('button', { name: 'He went home.', exact: true }).click();
    await page.getByRole('button', { name: /^(Next|Finish)/ }).click();
  }

  await expect(page.getByRole('heading', { name: 'Lesson done!' })).toBeVisible();
  await expect(page.getByText('Tricky today')).toBeVisible();
  await expect(page.getByText('was, were')).toBeVisible();
  await expect.poll(async () => (await sql`select state from wp_student_skills where student_id = ${jun.id} and skill = 'was-were'`)[0]?.state).toBe('active');

  await page.getByRole('link', { name: 'Practice again: was, were' }).click();
  await expect(page).toHaveURL(/\/practice\?skill=was-were$/);
  await expect(page.getByRole('progressbar')).toBeVisible();
});
