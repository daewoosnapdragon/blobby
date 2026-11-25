import postgres from 'postgres';
import fs from 'node:fs';
import { pgOptions } from '../../../src/lib/db/options';
import path from 'node:path';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/wp_test';

const MIGRATION = path.resolve(__dirname, '../../../supabase/migrations/0001_wp_init.sql');

/** Drops and recreates the test database, creates anon/authenticated roles, applies the migration. */
export async function resetTestDb(databaseUrl: string = TEST_DATABASE_URL): Promise<ReturnType<typeof postgres>> {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(dbName) || !dbName.includes('test')) {
    throw new Error(`Refusing to reset database "${dbName}": name must contain "test"`);
  }
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin.unsafe(`create database ${dbName}`);
    for (const role of ['anon', 'authenticated']) {
      const [r] = await admin`select 1 as x from pg_roles where rolname = ${role}`;
      if (!r) await admin.unsafe(`create role ${role} nologin`);
    }
  } finally {
    await admin.end();
  }
  // Mimic Supabase: new tables are granted to anon/authenticated by default, so the
  // migration's revokes are what actually locks them. Must run BEFORE the migration.
  const db = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    await db.unsafe('grant usage on schema public to anon, authenticated');
    await db.unsafe('alter default privileges in schema public grant all on tables to anon, authenticated');
  } finally {
    await db.end();
  }
  const sql = postgres(databaseUrl, { ...pgOptions, max: 4, onnotice: () => {} });
  await sql.unsafe(fs.readFileSync(MIGRATION, 'utf8'));
  return sql;
}
