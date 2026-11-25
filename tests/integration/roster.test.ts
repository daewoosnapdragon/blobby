import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetTestDb } from './helpers/db';
import { importRoster, parseRoster } from '@/lib/roster';

const HEAD = 'UUID,Name,Korean Name,Grade,English Class,Korean Class,Class Number,Active';
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const csv = [HEAD,
  `${u(1)},Kim Ann (Mo),x,1,Snapdragon,y,1,Yes`,
  `${u(2)},Lee Bo,x,2,Snapdragon,y,1,Yes`,
  `${u(3)},Lee Cy,x,3,Snapdragon,y,1,Yes`,
  `${u(4)},Lee Di,x,4,Snapdragon,y,1,Yes`,
  `${u(5)},Lee Ed,x,4,Snapdragon,y,1,Yes`,
].join('\n');

let sql: Awaited<ReturnType<typeof resetTestDb>>;
beforeAll(async () => { sql = await resetTestDb(); });
afterAll(async () => { await sql?.end(); });

describe('importRoster', () => {
  it('imports once, re-runs without changing codes, secrets, or edited names', async () => {
    const parsed = parseRoster(csv);
    const first = await importRoster(sql, parsed);
    expect(first).toEqual({ classes: 4, students: 5, byGrade: [1, 1, 1, 2] });

    const classes = await sql`select name, class_code from wp_classes order by name`;
    expect(classes.map((c) => c.name)).toEqual(['Snapdragon G1', 'Snapdragon G2', 'Snapdragon G3', 'Snapdragon G4']);
    const before = await sql`select id, display_name, link_secret, blob_color from wp_students order by id`;
    expect(before).toHaveLength(5);
    expect(before[0].display_name).toBe('Mo');

    await sql`update wp_students set display_name = 'Moxie', blob_color = '#FFD95A' where id = ${u(1)}`;
    // a student missing from the later export is left alone
    const later = parseRoster(csv.split('\n').filter((l) => !l.startsWith(u(5))).join('\n'));
    await importRoster(sql, later);
    await importRoster(sql, parsed);

    const classesAfter = await sql`select name, class_code from wp_classes order by name`;
    expect(classesAfter).toEqual(classes);
    const after = await sql`select id, display_name, link_secret, blob_color from wp_students order by id`;
    expect(after).toHaveLength(5);
    expect(after[0].display_name).toBe('Moxie');
    expect(after[0].blob_color).toBe('#FFD95A');
    expect(after.map((s) => s.link_secret)).toEqual(before.map((s) => s.link_secret));
  });

  it('updates class_id when a student changes grade', async () => {
    const moved = parseRoster(csv.replace(`${u(2)},Lee Bo,x,2,`, `${u(2)},Lee Bo,x,3,`));
    await importRoster(sql, moved);
    const [r] = await sql`select c.grade from wp_students s join wp_classes c on c.id = s.class_id where s.id = ${u(2)}`;
    expect(r.grade).toBe(3);
  });
});
