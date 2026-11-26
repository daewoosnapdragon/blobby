// Review-bank files: content/review-bank-g<N>.json = { "grade": N, "skills": { "<skill key>": [question, ...] } }.
// Bank questions are wp_questions rows with bank_grade (no lesson); position counts within a skill from 1.
import { z } from 'zod';
import { parseQuestion, type NonWatchQuestion } from './questions/schema';
import { isSkillKey, type SkillKey } from './skills';

export interface BankQuestion { skill: SkillKey; position: number; question: NonWatchQuestion }
export interface BankFile { grade: number; questions: BankQuestion[] }

const fileSchema = z.object({
  grade: z.number().int().min(1).max(4),
  skills: z.record(z.string(), z.array(z.unknown())),
});

export function parseBank(raw: unknown): BankFile {
  const shape = fileSchema.safeParse(raw);
  if (!shape.success) throw new Error(`Invalid bank file: ${shape.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`);
  const questions: BankQuestion[] = [];
  for (const [skill, list] of Object.entries(shape.data.skills)) {
    if (!isSkillKey(skill)) throw new Error(`Invalid bank file: unknown skill ${JSON.stringify(skill)}`);
    list.forEach((raw, i) => {
      const where = `${skill}, question ${i + 1}`;
      if (!raw || typeof raw !== 'object' || typeof (raw as { type?: unknown }).type !== 'string') throw new Error(`${where}: missing "type"`);
      const { type, skill: _s, ...payload } = raw as { type: string; skill?: unknown };
      if (type === 'watch_answer') throw new Error(`${where}: a video question can't be a review question`);
      let q;
      try { q = parseQuestion(type, payload); } catch (e) { throw new Error(`${where}: ${e instanceof Error ? e.message : String(e)}`); }
      questions.push({ skill, position: i + 1, question: q as NonWatchQuestion });
    });
  }
  return { grade: shape.data.grade, questions };
}
