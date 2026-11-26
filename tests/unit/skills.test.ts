import { describe, expect, it } from 'vitest';
import { SKILLS, SKILL_KEYS, isSkillKey } from '@/lib/skills';

describe('skills', () => {
  it('has the 8 pretest error groups', () => {
    for (const k of ['be', 'ing', 'sentence-ends', 'articles', 'plurals', 'past-tense', 'third-person-s', 'prepositions']) {
      expect(isSkillKey(k), k).toBe(true);
    }
  });
  it('covers every skill used in the lesson files', () => {
    for (const k of ['capitals-names', 'there-is-are', 'was-were', 'irregular-past', 'did-didnt', 'irregular-plurals', 'comparatives']) {
      expect(isSkillKey(k), k).toBe(true);
    }
  });
  it('gives every skill a label for Kyla and words for kids', () => {
    for (const k of SKILL_KEYS) {
      expect(SKILLS[k].label.length, k).toBeGreaterThan(2);
      expect(SKILLS[k].kid.length, k).toBeGreaterThan(2);
    }
  });
  it('rejects anything else', () => {
    expect(isSkillKey('nope')).toBe(false);
    expect(isSkillKey(undefined)).toBe(false);
    expect(isSkillKey('__proto__')).toBe(false);
  });
});
