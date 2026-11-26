import { describe, expect, it } from 'vitest';
import { databaseUrlProblem } from '@/lib/db/options';

describe('databaseUrlProblem', () => {
  it('accepts the shared transaction pooler', () => {
    expect(databaseUrlProblem('postgresql://postgres.abc:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres')).toBeNull();
  });
  it('flags the shared pooler in session mode (port 5432)', () => {
    expect(databaseUrlProblem('postgresql://postgres.abc:pw@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres')).toMatch(/session/i);
  });
  it('flags the IPv6-only db.<ref>.supabase.co address', () => {
    expect(databaseUrlProblem('postgresql://postgres:pw@db.abc.supabase.co:6543/postgres')).toMatch(/IPv6/);
    expect(databaseUrlProblem('postgresql://postgres:pw@db.abc.supabase.co:5432/postgres')).toMatch(/IPv6/);
  });
  it('leaves local and unknown hosts alone', () => {
    expect(databaseUrlProblem('postgres://postgres:postgres@localhost:5432/wp_test')).toBeNull();
    expect(databaseUrlProblem('not a url')).toBeNull();
  });
});
