import { describe, it, expect } from 'vitest';
import { computeClassStats, skillHistory, formatDuration } from '@/lib/stats';
import { isTeacherEmail, parseTeacherEmails } from '@/lib/teacherAuth';

const students = [
  { id: 's1', displayName: 'Mina', blobColor: 'mint' },
  { id: 's2', displayName: 'Leo', blobColor: null },
];
const lessons = [
  { id: 'l1', weekId: 'w1', weekSkill: 'Past tense' },
  { id: 'l2', weekId: 'w1', weekSkill: 'Past tense' },
  { id: 'l3', weekId: 'w2', weekSkill: 'Plurals' },
];
const base = { students, starEvents: [], practiceDays: [], completions: [], lessons, attempts: [] };
const row = (r: ReturnType<typeof computeClassStats>, id: string) => r.find((x) => x.studentId === id)!;

describe('computeClassStats', () => {
  it('returns one row per student with name and color, zeros when nothing happened', () => {
    const r = computeClassStats(base);
    expect(r).toHaveLength(2);
    expect(row(r, 's1')).toEqual({
      studentId: 's1', displayName: 'Mina', blobColor: 'mint',
      stars: 0, daysPracticed: 0, secondsPracticed: 0, weeksDone: 0, lastSkill: null,
    });
  });

  it('sums stars per student', () => {
    const r = computeClassStats({
      ...base,
      starEvents: [
        { studentId: 's1', amount: 10 }, { studentId: 's1', amount: 10 }, { studentId: 's1', amount: 1 },
        { studentId: 's2', amount: 10 },
      ],
    });
    expect(row(r, 's1').stars).toBe(21);
    expect(row(r, 's2').stars).toBe(10);
  });

  it('days are distinct practice_days rows and time is the sum of seconds', () => {
    const r = computeClassStats({
      ...base,
      practiceDays: [
        { studentId: 's1', day: '2026-12-20', seconds: 600 },
        { studentId: 's1', day: '2026-12-21', seconds: 125 },
        { studentId: 's1', day: '2026-12-21', seconds: 5 }, // same day twice never counts twice
        { studentId: 's2', day: '2026-12-20', seconds: 60 },
      ],
    });
    expect(row(r, 's1').daysPracticed).toBe(2);
    expect(row(r, 's1').secondsPracticed).toBe(730);
    expect(row(r, 's2').daysPracticed).toBe(1);
  });

  it('a week is done only when all of its lessons are complete', () => {
    const r = computeClassStats({
      ...base,
      completions: [
        { studentId: 's1', lessonId: 'l1' }, { studentId: 's1', lessonId: 'l2' }, // w1 done
        { studentId: 's2', lessonId: 'l1' },                                      // w1 half
        { studentId: 's2', lessonId: 'l3' },                                      // w2 done
      ],
    });
    expect(row(r, 's1').weeksDone).toBe(1);
    expect(row(r, 's2').weeksDone).toBe(1);
    const both = computeClassStats({ ...base, completions: [{ studentId: 's1', lessonId: 'l1' }] });
    expect(row(both, 's1').weeksDone).toBe(0);
  });

  it('lastSkill comes from the newest attempt', () => {
    const r = computeClassStats({
      ...base,
      attempts: [
        { studentId: 's1', questionId: 'q1', lessonId: 'l1', createdAt: new Date('2026-12-20T01:00:00Z') },
        { studentId: 's1', questionId: 'q3', lessonId: 'l3', createdAt: new Date('2026-12-22T01:00:00Z') },
        { studentId: 's1', questionId: 'q2', lessonId: 'l2', createdAt: new Date('2026-12-21T01:00:00Z') },
      ],
    });
    expect(row(r, 's1').lastSkill).toBe('Plurals');
    expect(row(r, 's2').lastSkill).toBeNull();
  });

  it('attempts on a soft-deleted question still count toward lastSkill and days (Review Focus #4)', () => {
    // The query keeps the attempt with its question's lesson even when wp_questions.deleted_at is set,
    // so the stats see an ordinary attempt row whose questionId nobody lists any more.
    const r = computeClassStats({
      ...base,
      attempts: [{ studentId: 's2', questionId: 'deleted-question', lessonId: 'l3', createdAt: new Date('2026-12-22T01:00:00Z') }],
      practiceDays: [{ studentId: 's2', day: '2026-12-22', seconds: 90 }],
    });
    expect(row(r, 's2').lastSkill).toBe('Plurals');
    expect(row(r, 's2').daysPracticed).toBe(1);
  });
});

describe('skillHistory', () => {
  const attempts = [
    { studentId: 's1', questionId: 'q1', lessonId: 'l1', createdAt: new Date('2026-12-20T01:00:00Z') },
    { studentId: 's1', questionId: 'q2', lessonId: 'l2', createdAt: new Date('2026-12-20T02:00:00Z') },
    { studentId: 's1', questionId: 'q3', lessonId: 'l3', createdAt: new Date('2026-12-22T01:00:00Z') },
    { studentId: 's1', questionId: 'q1', lessonId: 'l1', createdAt: new Date('2026-12-23T01:00:00Z') },
    { studentId: 's2', questionId: 'q9', lessonId: 'l3', createdAt: new Date('2026-12-24T01:00:00Z') },
  ];
  it('groups by skill, distinct Seoul dates newest first, skills ordered by most recent practice', () => {
    expect(skillHistory('s1', { attempts, lessons })).toEqual([
      { skill: 'Past tense', dates: ['2026-12-23', '2026-12-20'] },
      { skill: 'Plurals', dates: ['2026-12-22'] },
    ]);
  });
  it('uses the Seoul date, not UTC', () => {
    const late = [{ studentId: 's1', questionId: 'q', lessonId: 'l1', createdAt: new Date('2026-12-20T16:00:00Z') }];
    expect(skillHistory('s1', { attempts: late, lessons })[0].dates).toEqual(['2026-12-21']);
  });
  it('is empty for a kid with no attempts, and ignores unknown lessons', () => {
    expect(skillHistory('s2', { attempts: [], lessons })).toEqual([]);
    expect(skillHistory('s1', { attempts: [{ ...attempts[0], lessonId: 'gone' }], lessons })).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('is h:mm', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59)).toBe('0:00');
    expect(formatDuration(600)).toBe('0:10');
    expect(formatDuration(3725)).toBe('1:02');
  });
});

describe('teacher allowlist', () => {
  it('parses comma-separated, trimmed, case-insensitive', () => {
    expect(parseTeacherEmails(' Kyla@School.org , other@x.com ,, ')).toEqual(['kyla@school.org', 'other@x.com']);
    expect(isTeacherEmail('KYLA@school.org', 'kyla@school.org')).toBe(true);
    expect(isTeacherEmail(' kyla@school.org ', 'kyla@school.org,b@c.d')).toBe(true);
  });
  it('refuses everyone when the list is empty or unset, and empty/missing emails', () => {
    expect(isTeacherEmail('a@b.c', '')).toBe(false);
    expect(isTeacherEmail('a@b.c', undefined)).toBe(false);
    expect(isTeacherEmail(undefined, 'a@b.c')).toBe(false);
    expect(isTeacherEmail('', 'a@b.c')).toBe(false);
  });
});
