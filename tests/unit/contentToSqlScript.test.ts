import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const run = (...args: string[]) => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c2s-')), 'out.sql');
  const r = spawnSync(path.join(root, 'node_modules/.bin/tsx'), ['scripts/content-to-sql.ts', out, ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout, out };
};

describe('scripts/content-to-sql.ts arguments', () => {
  it('--update refuses more than one content file', () => {
    const r = run('--update', '--base', 'git:HEAD', 'content/test-plan.json', 'content/review-bank-g1.json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--update takes one content file at a time (the SQL editor shows only the last query's result). Run it once per file.");
    expect(fs.existsSync(r.out)).toBe(false);
  });

  it('a git:<ref> that does not resolve is a hard error', () => {
    const r = run('--update', '--base', 'git:no-such-ref-xyz', 'content/test-plan.json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('git cannot find "no-such-ref-xyz"');
    expect(fs.existsSync(r.out)).toBe(false);
  });

  it('one file with a valid ref writes PART 1 and PART 2', () => {
    const r = run('--update', '--base', 'git:HEAD', 'content/test-plan.json');
    expect(r.status).toBe(0);
    const text = fs.readFileSync(r.out, 'utf8');
    expect(text).toContain('PART 1: LOOK FIRST');
    expect(text).toContain('PART 2: APPLY');
  });

  it('a file missing at a valid ref only warns and lists every row', () => {
    const tmp = path.join(root, 'content', `.c2s-missing-${process.pid}.json`);
    fs.copyFileSync(path.join(root, 'content/test-plan.json'), tmp);
    try {
      const r = run('--update', '--base', 'git:HEAD', path.relative(root, tmp));
      expect(r.status).toBe(0);
      expect(r.stderr).toMatch(/Warning: .* is not in HEAD/);
      expect(fs.readFileSync(r.out, 'utf8')).toContain('no base file given');
    } finally { fs.unlinkSync(tmp); }
  });

  it('without --update, several files are still fine', () => {
    const r = run('content/test-plan.json', 'content/review-bank-g1.json');
    expect(r.status).toBe(0);
    expect(fs.readFileSync(r.out, 'utf8')).not.toContain('PART 1');
  });
});
