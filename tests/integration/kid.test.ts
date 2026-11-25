import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, CLASS, STUDENTS } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
});
afterAll(async () => {
  await sql.end();
});

describe('kid lookups', () => {
  it('finds a student by link secret, and not by a wrong one', async () => {
    const { studentBySecret } = await import('@/lib/db/kid');
    expect((await studentBySecret(STUDENTS.leo.secret))?.display_name).toBe('Leo');
    expect(await studentBySecret('nope')).toBeNull();
  });

  it('lists names for a class code, case-insensitive, with blob colors', async () => {
    const { classByCode } = await import('@/lib/db/kid');
    const r = await classByCode(CLASS.code.toLowerCase());
    expect(r?.classId).toBe(CLASS.id);
    expect(r?.names.map((n) => n.displayName).sort()).toEqual(['Jun', 'Leo', 'Mina']);
    expect(r?.names.find((n) => n.displayName === 'Leo')?.blobColor).toBe('mint');
    expect(await classByCode('ZZZZZZ')).toBeNull();
  });

  it('only joins a student that belongs to the class', async () => {
    const { studentForJoin } = await import('@/lib/db/kid');
    expect((await studentForJoin(CLASS.code, STUDENTS.jun.id))?.display_name).toBe('Jun');
    expect(await studentForJoin('ZZZZZZ', STUDENTS.jun.id)).toBeNull();
    const other = '00000000-0000-4000-8000-0000000000c2';
    await sql`insert into wp_classes (id, grade, name, class_code) values (${other}, 2, 'Snapdragon G2', 'XYZ789')`;
    await sql`insert into wp_students (id, class_id, display_name, link_secret) values ('00000000-0000-4000-8000-000000000009', ${other}, 'Zed', 'zed-secret')`;
    expect(await studentForJoin(CLASS.code, '00000000-0000-4000-8000-000000000009')).toBeNull();
  });
});
