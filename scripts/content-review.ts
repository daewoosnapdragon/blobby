// Usage: npx tsx scripts/content-review.ts <git-ref> <out.md>
// Writes the review list for the content pass: for each of the eight content files, the base comes from
// `git show <ref>:<file>`, the content pass runs on it in memory (as scripts/content-pass.ts would), and the
// working file is compared with the result (see src/lib/contentReview.ts). Prints the counts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { contentGroups, passRawQuestions, type RawQuestion } from '../src/lib/contentPass';
import { classifyChanges, countChanges, renderFileReview, type ReviewCounts, type ReviewGroup } from '../src/lib/contentReview';
import type { Question } from '../src/lib/questions/schema';

const FILES = [1, 2, 3, 4].map((g) => `content/test-week-g${g}.json`).concat([1, 2, 3, 4].map((g) => `content/review-bank-g${g}.json`));

const INTRO = `# Content pass, Nov 26: what changed

Kyla, this is everything that changed in the eight content files (test weeks and review banks, Grades 1 to 4)
before you load them. Each file has three parts:

- **Skim: names.** Questions whose names changed (Mia → Nova and so on). One line each, showing the
  right answer. Some of them also got a new prompt and are in both skim sections. A quick look is enough:
  about 5 minutes for all eight files.
- **Skim: prompts.** The instructions at the top of a question ("Which one is right?"). A table of old → new
  with how many times, then each lesson's prompts in order, so you can see they take turns. Most
  are the fixed rotation; ones marked "(by hand)" were written for that question. About 5 minutes.
- **Read: new and silly.** The questions to read properly: each **new** question (Q13 to Q15 in every
  test-week lesson, Q11 in every review-bank skill) and each **silly** rewrite (same grammar, sillier scene).
  Under a rewrite, "was:" is the question as it is in the app today, before this pass, and a "names:" or
  "prompt:" line lists the name or prompt changes it also got. Two are marked "name changed": a teacher's
  name changed, not the scene. The right answer is marked ✔ and the picture is named. "picture unchanged,
  check it" means the words changed but the picture did not. This is the longer part: about 30 to 40 minutes.

Q numbers are positions in the lesson or skill. If anything is off, fix it in the app's editor after
loading, or tell Claude what to change.
`;

function gitShow(ref: string, file: string): unknown {
  return JSON.parse(execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

const [ref, out] = process.argv.slice(2);
if (!ref || !out) {
  console.log('Usage: npx tsx scripts/content-review.ts <git-ref> <out.md>');
  process.exit(1);
}

const sections: string[] = [];
const total: ReviewCounts = { renamed: 0, reprompted: 0, added: 0, rewritten: 0, pictureChecks: 0 };
for (const file of FILES) {
  const baseGroups = contentGroups(gitShow(ref, file));
  const currentGroups = contentGroups(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (baseGroups.length !== currentGroups.length) throw new Error(`${file}: ${baseGroups.length} groups in ${ref}, ${currentGroups.length} now`);
  const groups: ReviewGroup[] = currentGroups.map((g, i) => {
    const b = baseGroups[i];
    if (b.seed !== g.seed) throw new Error(`${file}: group ${i + 1} is ${b.where} in ${ref} but ${g.where} now`);
    const base = b.get();
    const passed = passRawQuestions(base, b.seed, b.skill).questions;
    const asQuestions = (qs: RawQuestion[]) => qs as unknown as Question[];
    return { label: g.label, changes: classifyChanges(asQuestions(passed), asQuestions(g.get()), asQuestions(base)), questions: asQuestions(g.get()), base: asQuestions(base) };
  });
  const c = countChanges(groups);
  (Object.keys(total) as (keyof ReviewCounts)[]).forEach((k) => { total[k] += c[k]; });
  sections.push(renderFileReview(path.basename(file), groups));
  console.log(`${file}: renamed ${c.renamed}, reprompted ${c.reprompted}, added ${c.added}, rewritten ${c.rewritten}, picture checks ${c.pictureChecks}`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, [INTRO, ...sections].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
console.log(`total: renamed ${total.renamed}, reprompted ${total.reprompted}, added ${total.added}, rewritten ${total.rewritten}, picture checks ${total.pictureChecks}`);
console.log(`wrote ${out}`);
