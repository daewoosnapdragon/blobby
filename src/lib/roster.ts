// Roster import: pure CSV parsing plus an idempotent DB writer.
// No server-only import here: scripts/import-roster.ts runs this under tsx.
// Privacy: Korean Name, Korean Class and Class Number are never read into any output,
// and error messages name row numbers only, never students.
import { randomBytes, randomInt } from 'node:crypto';
import Papa from 'papaparse';
import type postgres from 'postgres';

export interface RosterStudent { id: string; grade: number; displayName: string }
export interface ParsedRoster { classes: { grade: number }[]; students: RosterStudent[] }
export interface ImportSummary { classes: number; students: number; byGrade: [number, number, number, number] }

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED = ['UUID', 'Name', 'Grade', 'English Class', 'Active'];

export function makeClassCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export function makeLinkSecret(): string {
  return randomBytes(24).toString('base64url');
}

/** "Kim Min Jun (Leo)" -> "Leo"; "Ok Ha Neul" -> "Ha Neul"; "Park Aurora" -> "Aurora". */
export function displayNameFrom(name: string): string {
  const eng = /\(([^)]*)\)/.exec(name)?.[1].trim();
  if (eng) return eng;
  const tokens = name.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean);
  return tokens.length > 1 ? tokens.slice(1).join(' ') : (tokens[0] ?? '');
}

/** "1", "Grade 1", "G1" -> 1; anything without digits -> null. */
export function parseGrade(raw: string): number | null {
  const m = /\d+/.exec(raw ?? '');
  return m ? Number(m[0]) : null;
}

function surnameInitial(name: string): string {
  const first = name.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/)[0] ?? '';
  return first.charAt(0).toUpperCase();
}

export function parseRoster(csv: string): ParsedRoster {
  const text = csv.replace(/^﻿/, '');
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const fields = res.meta.fields ?? [];
  const missing = REQUIRED.filter((f) => !fields.includes(f));
  if (missing.length) throw new Error(`Roster CSV is missing column(s): ${missing.join(', ')}`);

  const kept: { id: string; grade: number; name: string }[] = [];
  const seen = new Set<string>();
  res.data.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    if ((r['English Class'] ?? '').trim().toLowerCase() !== 'snapdragon') return;
    if ((r['Active'] ?? '').trim().toLowerCase() !== 'yes') return;
    const grade = parseGrade(r['Grade']);
    if (grade === null || grade < 1 || grade > 4) return;
    const id = (r['UUID'] ?? '').trim().toLowerCase();
    if (!UUID_RE.test(id)) throw new Error(`Roster row ${rowNo}: UUID is not a valid UUID`);
    const name = (r['Name'] ?? '').trim();
    if (!displayNameFrom(name)) throw new Error(`Roster row ${rowNo}: Name is empty`);
    if (seen.has(id)) throw new Error(`Roster row ${rowNo}: duplicate UUID`);
    seen.add(id);
    kept.push({ id, grade, name });
  });

  // Duplicate display names are resolved per grade (one class per grade):
  // 1) a colliding name gets the surname's initial: "Leo K.";
  // 2) names that still collide are numbered in UUID order, the first keeping "Leo K.",
  //    the rest "Leo K. 2", "Leo K. 3". Deterministic regardless of CSV row order.
  const base = kept.map((k) => ({ ...k, display: displayNameFrom(k.name) }));
  const key = (g: number, d: string) => `${g}|${d.toLowerCase()}`;
  const counts = new Map<string, number>();
  for (const b of base) counts.set(key(b.grade, b.display), (counts.get(key(b.grade, b.display)) ?? 0) + 1);
  const withInitial = base.map((b) => ({
    ...b,
    display: counts.get(key(b.grade, b.display))! > 1 ? `${b.display} ${surnameInitial(b.name)}.` : b.display,
  }));
  const groups = new Map<string, typeof withInitial>();
  for (const b of withInitial) {
    const k = key(b.grade, b.display);
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const final = new Map<string, string>();
  for (const g of groups.values()) {
    g.sort((a, b) => a.id.localeCompare(b.id)).forEach((b, i) => {
      final.set(b.id, i === 0 ? b.display : `${b.display} ${i + 1}`);
    });
  }

  const students = withInitial.map((b) => ({ id: b.id, grade: b.grade, displayName: final.get(b.id)! }));
  const grades = [...new Set(students.map((s) => s.grade))].sort();
  return { classes: grades.map((grade) => ({ grade })), students };
}

/**
 * Idempotent writer (ruling R16). Class codes are generated only for new class rows;
 * new students get a link secret and no blob color. Existing students keep display_name,
 * link_secret and blob_color; only class_id may change. Students absent from this
 * export are left alone.
 */
export async function importRoster(sql: postgres.Sql, parsed: ParsedRoster): Promise<ImportSummary> {
  return sql.begin(async (tx) => {
    const classIds = new Map<number, string>();
    for (const { grade } of parsed.classes) {
      const name = `Snapdragon G${grade}`;
      const [existing] = await tx`select id from wp_classes where name = ${name} order by id limit 1`;
      if (existing) { classIds.set(grade, existing.id); continue; }
      for (;;) {
        const [row] = await tx`
          insert into wp_classes (grade, name, class_code) values (${grade}, ${name}, ${makeClassCode()})
          on conflict (class_code) do nothing returning id`;
        if (row) { classIds.set(grade, row.id); break; }
      }
    }
    const byGrade: [number, number, number, number] = [0, 0, 0, 0];
    for (const s of parsed.students) {
      byGrade[s.grade - 1]++;
      await tx`
        insert into wp_students (id, class_id, display_name, link_secret)
        values (${s.id}, ${classIds.get(s.grade)!}, ${s.displayName}, ${makeLinkSecret()})
        on conflict (id) do update set class_id = excluded.class_id`;
    }
    return { classes: classIds.size, students: parsed.students.length, byGrade };
  });
}
