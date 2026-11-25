import { describe, expect, it } from 'vitest';
import { displayNameFrom, makeClassCode, makeLinkSecret, parseRoster, parseGrade } from '@/lib/roster';

const HEAD = 'UUID,Name,Korean Name,Grade,English Class,Korean Class,Class Number,Active';
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, name: string, grade: string, cls = 'Snapdragon', active = 'Yes') =>
  `${u(n)},"${name}",한글,${grade},${cls},반,7,${active}`;
const csv = (...rows: string[]) => [HEAD, ...rows].join('\n');

describe('displayNameFrom', () => {
  it('uses the English name in parentheses', () => expect(displayNameFrom('Kim Min Jun (Leo)')).toBe('Leo'));
  it('drops the surname otherwise', () => {
    expect(displayNameFrom('Ok Ha Neul')).toBe('Ha Neul');
    expect(displayNameFrom('Park Aurora')).toBe('Aurora');
  });
  it('keeps a single token', () => expect(displayNameFrom('Aurora')).toBe('Aurora'));
});

describe('parseGrade', () => {
  it('reads common shapes', () => {
    for (const g of ['1', ' 1 ', 'Grade 1', 'G1', 'grade1']) expect(parseGrade(g)).toBe(1);
    expect(parseGrade('')).toBeNull();
    expect(parseGrade('K')).toBeNull();
  });
});

describe('parseRoster', () => {
  it('keeps active Snapdragon grades 1-4 only and has no Korean fields', () => {
    const r = parseRoster(csv(
      row(1, 'Lee Ann', '1'),
      row(2, 'Lee Bo', 'Grade 2'),
      row(3, 'Lee Cy', 'G3'),
      row(4, 'Lee Di', '4'),
      row(5, 'Lee Ed', '5'),
      row(6, 'Lee Fa', '1', 'Daisy'),
      row(7, 'Lee Gus', '1', 'Snapdragon', 'No'),
    ));
    expect(r.students).toEqual([
      { id: u(1), grade: 1, displayName: 'Ann' },
      { id: u(2), grade: 2, displayName: 'Bo' },
      { id: u(3), grade: 3, displayName: 'Cy' },
      { id: u(4), grade: 4, displayName: 'Di' },
    ]);
    expect(r.classes).toEqual([{ grade: 1 }, { grade: 2 }, { grade: 3 }, { grade: 4 }]);
    expect(JSON.stringify(r)).not.toMatch(/한글|반/);
  });
  it('tolerates a BOM and CRLF', () => {
    const r = parseRoster('﻿' + csv(row(1, 'Lee Ann', '1')).replace(/\n/g, '\r\n'));
    expect(r.students).toHaveLength(1);
  });
  it('adds the surname initial to duplicate names within a grade', () => {
    const r = parseRoster(csv(
      row(1, 'Kim Min Jun (Leo)', '1'), row(2, 'Park Ji Ho (Leo)', '1'), row(3, 'Choi Yu (Leo)', '2'),
    ));
    expect(r.students.map((s) => s.displayName)).toEqual(['Leo K.', 'Leo P.', 'Leo']);
  });
  it('numbers names that still collide, in UUID order', () => {
    const r = parseRoster(csv(
      row(2, 'Kim A (Leo)', '1'), row(1, 'Kim B (Leo)', '1'), row(3, 'Kim C (Leo)', '1'),
    ));
    const by = Object.fromEntries(r.students.map((s) => [s.id, s.displayName]));
    expect(by[u(1)]).toBe('Leo K.');
    expect(by[u(2)]).toBe('Leo K. 2');
    expect(by[u(3)]).toBe('Leo K. 3');
  });
  it('rejects malformed uuids without echoing names', () => {
    expect(() => parseRoster(csv('nope,"Lee Ann",x,1,Snapdragon,y,1,Yes'))).toThrow(/row 2/);
  });
  it('throws on missing columns', () => {
    expect(() => parseRoster('UUID,Name\n1,2')).toThrow(/column/i);
  });
});

describe('generators', () => {
  it('class code', () => {
    for (let i = 0; i < 50; i++) expect(makeClassCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
  it('link secret', () => {
    const s = makeLinkSecret();
    expect(s.length).toBeGreaterThanOrEqual(32);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(makeLinkSecret()).not.toBe(s);
  });
});
