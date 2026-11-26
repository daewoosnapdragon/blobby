// Review-track rules (pure). The data layer loads a kid's skills and answers, calls these, and saves the result.
// Rules (spec + Kyla, Nov 26): a skill missed twice in one lesson joins the track; 6 right in a row masters it;
// a mastered skill comes back every 3rd lesson, then 6th, then 12th; one miss makes it a working skill again.
import type { SkillKey } from './skills';
import type { SkillSource, SkillState } from './types';

export type TrackSkill = {
  skill: SkillKey; source: SkillSource; state: SkillState;
  /** when mastered: shows every Nth lesson */ spacing: number;
  /** lessons since it last showed (mastered skills) */ lessonsSince: number;
  removedByTeacher: boolean; addedAt: string;
};
export type BankItem = { id: string; lastAnswer: 'missed' | 'right' | null; lastSeen: string | null };
export type RunAnswer = { skill: SkillKey; right: boolean };

export const MASTER_AFTER = 6;
export const MAX_AUTO_ACTIVE = 4;
const FIRST_SPACING = 3;
const MAX_SPACING = 12;

/** Skills that get review questions in the next lesson: working skills, plus mastered ones whose turn has come. */
export function dueSkills(skills: TrackSkill[]): SkillKey[] {
  const active = skills.filter((s) => s.state === 'active').sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const mastered = skills.filter((s) => s.state === 'mastered' && s.lessonsSince + 1 >= s.spacing);
  return [...active, ...mastered].map((s) => s.skill);
}

/** FNV-1a, for choices that are stable for a seed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

/**
 * Up to n bank question ids for a lesson: skills take turns (starting from a seed-chosen skill, so lessons vary),
 * and within a skill the kid's last-missed questions come first, then ones never seen, then the least recently seen.
 * The same seed always gives the same answer, so a reload mid-lesson shows the same questions.
 */
export function chooseReview(due: SkillKey[], bank: Map<SkillKey, BankItem[]>, seed: string, n = 3): string[] {
  const skills = due.filter((s) => (bank.get(s)?.length ?? 0) > 0);
  if (skills.length === 0) return [];
  const start = hash(seed) % skills.length;
  const order = [...skills.slice(start), ...skills.slice(0, start)];
  const rank = (b: BankItem) => (b.lastAnswer === 'missed' ? 0 : b.lastSeen === null ? 1 : 2);
  const queues = new Map(order.map((s) => [s, [...bank.get(s)!].sort((a, b) =>
    rank(a) - rank(b) || (a.lastSeen ?? '').localeCompare(b.lastSeen ?? '') || hash(seed + a.id) - hash(seed + b.id))]));
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) {
    const live = order.filter((s) => queues.get(s)!.length > 0);
    if (live.length === 0) break;
    const s = live[i % live.length];
    out.push(queues.get(s)!.shift()!.id);
  }
  return out;
}

/**
 * The track after one lesson run.
 * run: this run's saved answers with their skills; recent: each skill's latest answers (oldest first, this run
 * included); shown: skills that had review questions in this lesson.
 */
export function afterLesson(skills: TrackSkill[], run: RunAnswer[], recent: Map<SkillKey, boolean[]>, shown: SkillKey[], now: string): TrackSkill[] {
  const byKey = new Map(skills.map((s) => [s.skill, { ...s }]));
  const changed = new Set<SkillKey>();
  const set = (s: TrackSkill, patch: Partial<TrackSkill>) => { Object.assign(s, patch); changed.add(s.skill); };
  const missesInRun = (k: SkillKey) => run.filter((a) => a.skill === k && !a.right).length;
  const steady = (k: SkillKey) => {
    const last = (recent.get(k) ?? []).slice(-MASTER_AFTER);
    return last.length >= MASTER_AFTER && last.every(Boolean);
  };
  const noRecentMiss = (k: SkillKey) => !(recent.get(k) ?? []).slice(-MASTER_AFTER).includes(false);

  for (const s of byKey.values()) {
    if (s.state === 'removed') continue;
    const missed = missesInRun(s.skill) > 0;
    if (s.state === 'mastered') {
      if (missed) set(s, { state: 'active', spacing: FIRST_SPACING, lessonsSince: 0 });
      else if (shown.includes(s.skill)) set(s, { spacing: Math.min(s.spacing * 2, MAX_SPACING), lessonsSince: 0 });
      else set(s, { lessonsSince: s.lessonsSince + 1 });
    } else if (s.source !== 'teacher' && steady(s.skill)) {
      set(s, { state: 'mastered', spacing: FIRST_SPACING, lessonsSince: 0 });
    }
  }

  // Skills missed twice in this run join the track (never one Kyla removed).
  const missedTwice = [...new Set(run.map((a) => a.skill))].filter((k) => missesInRun(k) >= 2);
  for (const k of missedTwice) {
    const existing = byKey.get(k);
    if (existing?.state === 'active') continue;
    if (existing?.removedByTeacher) continue;
    const counted = [...byKey.values()].filter((s) => s.state === 'active' && s.source !== 'teacher');
    if (counted.length >= MAX_AUTO_ACTIVE) {
      const giveWay = counted
        .filter((s) => (s.source === 'auto' || s.source === 'pretest') && noRecentMiss(s.skill))
        .sort((a, b) => a.addedAt.localeCompare(b.addedAt))[0];
      if (!giveWay) continue;
      set(giveWay, { state: 'mastered', spacing: FIRST_SPACING, lessonsSince: 0 });
    }
    if (existing) set(existing, { state: 'active', spacing: FIRST_SPACING, lessonsSince: 0 });
    else {
      const added: TrackSkill = { skill: k, source: 'auto', state: 'active', spacing: FIRST_SPACING, lessonsSince: 0, removedByTeacher: false, addedAt: now };
      byKey.set(k, added);
      changed.add(k);
    }
  }

  if (changed.size === 0) return skills;
  return [...byKey.values()];
}
