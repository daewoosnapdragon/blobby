import { describe, expect, it } from 'vitest';
import { afterLesson, chooseReview, dueSkills, type BankItem, type TrackSkill } from '@/lib/track';
import type { SkillKey } from '@/lib/skills';

const NOW = '2026-12-01T10:00:00Z';
const sk = (skill: SkillKey, over: Partial<TrackSkill> = {}): TrackSkill => ({
  skill, source: 'pretest', state: 'active', spacing: 3, lessonsSince: 0, removedByTeacher: false, addedAt: '2026-11-01T00:00:00Z', ...over,
});
const find = (list: TrackSkill[], s: SkillKey) => list.find((x) => x.skill === s);
const right = (n: number) => Array.from({ length: n }, () => true);

describe('dueSkills', () => {
  it('active skills are always due; removed never', () => {
    expect(dueSkills([sk('past-tense'), sk('articles', { state: 'removed' })])).toEqual(['past-tense']);
  });
  it('a mastered skill is due only when its spacing comes round', () => {
    expect(dueSkills([sk('plurals', { state: 'mastered', spacing: 3, lessonsSince: 1 })])).toEqual([]);
    expect(dueSkills([sk('plurals', { state: 'mastered', spacing: 3, lessonsSince: 2 })])).toEqual(['plurals']);
    expect(dueSkills([sk('plurals', { state: 'mastered', spacing: 6, lessonsSince: 4 })])).toEqual([]);
  });
});

describe('chooseReview', () => {
  const bank = new Map<SkillKey, BankItem[]>([
    ['past-tense', [{ id: 'p1', lastAnswer: 'right', lastSeen: '2026-11-20' }, { id: 'p2', lastAnswer: null, lastSeen: null }, { id: 'p3', lastAnswer: 'missed', lastSeen: '2026-11-25' }]],
    ['articles', [{ id: 'a1', lastAnswer: null, lastSeen: null }, { id: 'a2', lastAnswer: 'right', lastSeen: '2026-11-10' }]],
  ]);

  it('is the same for the same seed (a reload shows the same questions)', () => {
    expect(chooseReview(['past-tense', 'articles'], bank, 'kid:lesson:0')).toEqual(chooseReview(['past-tense', 'articles'], bank, 'kid:lesson:0'));
  });
  it('takes turns across skills and prefers missed, then unseen, then least recently seen', () => {
    const ids = chooseReview(['past-tense', 'articles'], bank, 'seed');
    expect(ids).toHaveLength(3);
    expect(ids.filter((i) => i.startsWith('p'))).toEqual(expect.arrayContaining(['p3']));
    const firstPast = ids.find((i) => i.startsWith('p'));
    expect(firstPast).toBe('p3');
    expect(ids.filter((i) => i.startsWith('a'))[0]).toBe('a1');
  });
  it('never repeats a question and stops when the bank runs out', () => {
    const small = new Map<SkillKey, BankItem[]>([['be', [{ id: 'b1', lastAnswer: null, lastSeen: null }]]]);
    expect(chooseReview(['be'], small, 's')).toEqual(['b1']);
  });
  it('returns nothing with no due skills or an empty bank', () => {
    expect(chooseReview([], bank, 's')).toEqual([]);
    expect(chooseReview(['plurals'], bank, 's')).toEqual([]);
  });
  it('different lessons start with different skills over time', () => {
    const firsts = new Set(Array.from({ length: 12 }, (_, i) => chooseReview(['past-tense', 'articles'], bank, `kid:lesson${i}:0`)[0][0]));
    expect(firsts.size).toBe(2);
  });
});

describe('afterLesson', () => {
  it('adds a skill missed twice in the lesson (not once)', () => {
    const once = afterLesson([], [{ skill: 'was-were', right: false }, { skill: 'was-were', right: true }], new Map(), [], NOW);
    expect(find(once, 'was-were')).toBeUndefined();
    const twice = afterLesson([], [{ skill: 'was-were', right: false }, { skill: 'was-were', right: false }], new Map(), [], NOW);
    expect(find(twice, 'was-were')).toMatchObject({ source: 'auto', state: 'active' });
  });
  it('never adds back a skill Kyla removed', () => {
    const r = afterLesson([sk('be', { state: 'removed', removedByTeacher: true, source: 'teacher' })],
      [{ skill: 'be', right: false }, { skill: 'be', right: false }], new Map(), [], NOW);
    expect(find(r, 'be')).toMatchObject({ state: 'removed' });
  });
  it('at 4 active skills, an old steady pretest skill steps aside for the new one', () => {
    const start = [sk('be', { addedAt: '2026-11-01' }), sk('ing', { addedAt: '2026-11-02' }), sk('articles', { addedAt: '2026-11-03' }), sk('plurals', { addedAt: '2026-11-04' })];
    // 'be' has no recent miss but too few answers to be mastered on its own, so only the swap can change it
    const recent = new Map<SkillKey, boolean[]>([['be', right(3)], ['ing', [false]], ['articles', [false]], ['plurals', [false]]]);
    const r = afterLesson(start, [{ skill: 'was-were', right: false }, { skill: 'was-were', right: false }], recent, [], NOW);
    expect(find(r, 'was-were')).toMatchObject({ state: 'active' });
    expect(find(r, 'be')).toMatchObject({ state: 'mastered', spacing: 3 });
    expect(find(r, 'ing')).toMatchObject({ state: 'active' });
  });
  it('at 4 active skills with no steady one, skips the add', () => {
    const start = [sk('be'), sk('ing'), sk('articles'), sk('plurals')];
    const recent = new Map<SkillKey, boolean[]>(['be', 'ing', 'articles', 'plurals'].map((s) => [s as SkillKey, [false]]));
    const r = afterLesson(start, [{ skill: 'was-were', right: false }, { skill: 'was-were', right: false }], recent, [], NOW);
    expect(find(r, 'was-were')).toBeUndefined();
  });
  it('teacher-added skills do not count toward the limit of 4', () => {
    const start = [sk('be'), sk('ing'), sk('articles'), sk('plurals', { source: 'teacher' })];
    const recent = new Map<SkillKey, boolean[]>(['be', 'ing', 'articles'].map((s) => [s as SkillKey, [false]]));
    const r = afterLesson(start, [{ skill: 'was-were', right: false }, { skill: 'was-were', right: false }], recent, [], NOW);
    expect(find(r, 'was-were')).toMatchObject({ state: 'active' });
  });
  it('masters a skill after its last 6 answers are right, but never one Kyla added', () => {
    const r = afterLesson([sk('past-tense'), sk('be', { source: 'teacher' })], [{ skill: 'past-tense', right: true }],
      new Map([['past-tense', right(6)], ['be', right(6)]]), ['past-tense'], NOW);
    expect(find(r, 'past-tense')).toMatchObject({ state: 'mastered', spacing: 3, lessonsSince: 0 });
    expect(find(r, 'be')).toMatchObject({ state: 'active' });
  });
  it('5 right is not enough', () => {
    const r = afterLesson([sk('past-tense')], [], new Map([['past-tense', right(5)]]), [], NOW);
    expect(find(r, 'past-tense')).toMatchObject({ state: 'active' });
  });
  it('a mastered skill shown and answered right comes back less often: 3 → 6 → 12, no further', () => {
    let list = [sk('plurals', { state: 'mastered', spacing: 3, lessonsSince: 2 })];
    for (const want of [6, 12, 12]) {
      list = afterLesson(list, [{ skill: 'plurals', right: true }], new Map([['plurals', right(6)]]), ['plurals'], NOW);
      expect(find(list, 'plurals')).toMatchObject({ state: 'mastered', spacing: want, lessonsSince: 0 });
    }
  });
  it('a mastered skill not shown counts one more lesson', () => {
    const r = afterLesson([sk('plurals', { state: 'mastered', spacing: 6, lessonsSince: 2 })], [], new Map(), [], NOW);
    expect(find(r, 'plurals')).toMatchObject({ lessonsSince: 3, spacing: 6 });
  });
  it('one miss on a mastered skill makes it a working skill again', () => {
    const r = afterLesson([sk('plurals', { state: 'mastered', spacing: 12, lessonsSince: 0 })], [{ skill: 'plurals', right: false }],
      new Map([['plurals', [...right(5), false]]]), ['plurals'], NOW);
    expect(find(r, 'plurals')).toMatchObject({ state: 'active', spacing: 3 });
  });
  it('a recent miss anywhere (practice too) makes a mastered skill a working skill again', () => {
    const r = afterLesson([sk('plurals', { state: 'mastered', spacing: 6, lessonsSince: 1 })], [],
      new Map([['plurals', [true, true, false]]]), [], NOW);
    expect(find(r, 'plurals')).toMatchObject({ state: 'active', spacing: 3 });
  });
  it('a skill the kid has barely answered never steps aside for a new one', () => {
    const start = [sk('be'), sk('ing'), sk('articles'), sk('plurals')];
    const recent = new Map<SkillKey, boolean[]>([['be', []], ['ing', [true, true]], ['articles', [false]], ['plurals', [false]]]);
    const r = afterLesson(start, [{ skill: 'was-were', right: false }, { skill: 'was-were', right: false }], recent, [], NOW);
    expect(find(r, 'was-were')).toBeUndefined();
    expect(r.every((s) => s.state === 'active')).toBe(true);
  });
  it('when two skills could step aside, the choice does not depend on row order', () => {
    const start = [sk('ing'), sk('be'), sk('articles'), sk('plurals')];
    const recent = new Map<SkillKey, boolean[]>([['be', [true, true, true]], ['ing', [true, true, true]], ['articles', [false]], ['plurals', [false]]]);
    const run = [{ skill: 'was-were' as SkillKey, right: false }, { skill: 'was-were' as SkillKey, right: false }];
    const a = afterLesson(start, run, recent, [], NOW);
    const b = afterLesson([...start].reverse(), run, recent, [], NOW);
    expect(find(a, 'be')!.state).toBe(find(b, 'be')!.state);
    expect(find(a, 'be')).toMatchObject({ state: 'mastered' });
  });
  it('leaves everything alone after a lesson with nothing to change', () => {
    const start = [sk('past-tense')];
    expect(afterLesson(start, [], new Map(), [], NOW)).toEqual(start);
  });
});
