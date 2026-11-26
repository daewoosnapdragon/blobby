// Usage: npx tsx scripts/check-content.ts <content.json | review-bank-gN.json> [...]
// Validates content files with the importer's own rules and prints a short summary. Writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { missingPictures, parseContent } from '../src/lib/content';
import { parseBank } from '../src/lib/bank';

const picturesDir = path.join(__dirname, '..', 'public', 'pictures');
const pictureExists = (name: string) => fs.existsSync(path.join(picturesDir, `${name}.svg`));
/** Throws naming where each picture first question's picture file is missing. */
function checkPictures(groups: { where: string; questions: Parameters<typeof missingPictures>[0] }[]) {
  const problems = groups.flatMap(({ where, questions }) =>
    missingPictures(questions, pictureExists).map((name) => `${where}: picture first picture "${name}" has no public/pictures/${name}.svg`));
  if (problems.length) throw new Error(problems.join('; '));
}

let failed = false;
for (const file of process.argv.slice(2)) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw && typeof raw === 'object' && 'skills' in raw && !('weeks' in raw)) {
      const b = parseBank(raw);
      const bySkill = new Map<string, typeof b.questions[number]['question'][]>();
      for (const q of b.questions) bySkill.set(q.skill, [...(bySkill.get(q.skill) ?? []), q.question]);
      checkPictures([...bySkill].map(([skill, questions]) => ({ where: `skill ${skill}`, questions })));
      const per = new Map<string, number>();
      const types = new Map<string, number>();
      for (const q of b.questions) { per.set(q.skill, (per.get(q.skill) ?? 0) + 1); types.set(q.question.type, (types.get(q.question.type) ?? 0) + 1); }
      console.log(`OK ${file}: review bank grade ${b.grade}, ${b.questions.length} questions; ${[...per].map(([k, n]) => `${k} ${n}`).join(', ')}; ${[...types].map(([t, n]) => `${t} ${n}`).join(', ')}`);
      continue;
    }
    const c = parseContent(raw);
    checkPictures(c.weeks.flatMap((w, wi) => w.lessons.map((l) => ({ where: `week ${wi + 1}, lesson "${l.title}"`, questions: l.questions }))));
    const counts = c.weeks.map((w) => w.lessons.map((l) => l.questions.length).join('+')).join(' | ');
    const types = new Map<string, number>();
    for (const w of c.weeks) for (const l of w.lessons) for (const q of l.questions) types.set(q.type, (types.get(q.type) ?? 0) + 1);
    console.log(`OK ${file}: grade ${c.assignTo.grade}, ${c.weeks.length} week(s), questions ${counts}; ${[...types].map(([t, n]) => `${t} ${n}`).join(', ')}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
process.exit(failed ? 1 : 0);
