import { describe, expect, it } from 'vitest';
import { appDbOptions, dbSsl, pgOptions, scriptDbOptions } from '@/lib/db/options';

const SUPA = 'postgres://postgres.abcd:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';
const LOCAL = 'postgres://postgres:postgres@localhost:5432/wp_test';

describe('dbSsl', () => {
  it('requires SSL for any non-local host', () => {
    expect(dbSsl(SUPA)).toBe('require');
    expect(dbSsl('postgres://u:p@db.example.com/x')).toBe('require');
  });
  it('leaves local connections without SSL', () => {
    expect(dbSsl(LOCAL)).toBe(false);
    expect(dbSsl('postgres://u:p@127.0.0.1:5432/x')).toBe(false);
    expect(dbSsl('postgres://u:p@[::1]:5432/x')).toBe(false);
  });
  it('always requires SSL in production, even for a local-looking host', () => {
    expect(dbSsl(LOCAL, { production: true })).toBe('require');
  });
  it('fails safe (SSL) on a url it cannot parse', () => {
    expect(dbSsl('not a url')).toBe('require');
  });
});

describe('connection options', () => {
  it('the shared test options carry no SSL setting', () => {
    expect('ssl' in pgOptions).toBe(false);
  });
  it('the app pool is sized for serverless, keeps prepare:false, and uses SSL in production', () => {
    const o = appDbOptions(SUPA, 'production');
    expect(o).toMatchObject({ prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10, ssl: 'require' });
    expect(o.types).toBe(pgOptions.types);
    expect(appDbOptions(LOCAL, 'development').ssl).toBe(false);
    expect(appDbOptions(LOCAL, 'production').ssl).toBe('require');
  });
  it('scripts use SSL for a remote host and none for localhost', () => {
    expect(scriptDbOptions(SUPA)).toMatchObject({ prepare: false, max: 1, ssl: 'require' });
    expect(scriptDbOptions(LOCAL).ssl).toBe(false);
  });
});
