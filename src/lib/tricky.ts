import { isSkillKey, type SkillKey } from './skills';

/** The skills a kid missed 2 or more times in one lesson run, most missed first, at most 2 ("Tricky today"). */
export function trickyToday(answers: { skill: string | null | undefined; right: boolean }[]): SkillKey[] {
  const misses = new Map<SkillKey, number>();
  for (const a of answers) if (!a.right && isSkillKey(a.skill)) misses.set(a.skill, (misses.get(a.skill) ?? 0) + 1);
  return [...misses].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
}
