// Fake data for e2e tests. Later tasks add their own rows via seedExtra helpers; keep these ids stable.
import type postgres from 'postgres';

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/wp_e2e_test';
export const E2E_SESSION_SECRET = 'e2e-session-secret-not-real';
export const E2E_PORT = 3100;

export const CLASS = { id: '00000000-0000-4000-8000-0000000000c1', grade: 1, name: 'Snapdragon G1', code: 'ABC234' };

export const STUDENTS = {
  mina: { id: '00000000-0000-4000-8000-000000000001', name: 'Mina', color: null as string | null, secret: 'e2e-secret-mina-0000000000000000000000' },
  leo: { id: '00000000-0000-4000-8000-000000000002', name: 'Leo', color: 'mint' as string | null, secret: 'e2e-secret-leo-00000000000000000000000' },
  jun: { id: '00000000-0000-4000-8000-000000000003', name: 'Jun', color: null as string | null, secret: 'e2e-secret-jun-00000000000000000000000' },
};

export async function seed(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`insert into wp_classes (id, grade, name, class_code) values (${CLASS.id}, ${CLASS.grade}, ${CLASS.name}, ${CLASS.code})`;
  for (const s of Object.values(STUDENTS)) {
    await sql`insert into wp_students (id, class_id, display_name, blob_color, link_secret)
      values (${s.id}, ${CLASS.id}, ${s.name}, ${s.color}, ${s.secret})`;
  }
}
