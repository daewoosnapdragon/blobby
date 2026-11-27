// Usage: npx tsx scripts/content-pass.ts <test-week-gN.json | review-bank-gN.json> [...]
// Rewrites each content file in place with the content pass (cast renames, Right/Wrong relabel, stock-prompt
// rotation; see src/lib/contentPass.ts). Plan files rotate per lesson (seed = lesson title), bank files per
// skill (seed = skill key). Running it twice changes nothing the second time.
import fs from 'node:fs';
import { contentGroups, passRawQuestions, type RawQuestion } from '../src/lib/contentPass';
import { parseQuestion } from '../src/lib/questions/schema';

/** Throws naming the question when a question (without its `skill`) is not valid. */
function validate(questions: RawQuestion[], where: string) {
  questions.forEach(({ type, skill: _skill, ...payload }, i) => {
    try { parseQuestion(type, payload); } catch (e) { throw new Error(`${where}, question ${i + 1}: ${e instanceof Error ? e.message : String(e)}`); }
  });
}

let failed = false;
for (const file of process.argv.slice(2)) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const groups = contentGroups(data);
    let renamed = 0, rotated = 0, relabeled = 0;
    for (const g of groups) {
      validate(g.get(), g.where);
      const r = passRawQuestions(g.get(), g.seed, g.skill);
      validate(r.questions, g.where);
      g.set(r.questions);
      renamed += r.renamed; rotated += r.rotated; relabeled += r.relabeled;
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`${file}: renamed ${renamed}, rotated ${rotated}, relabeled ${relabeled}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
process.exit(failed ? 1 : 0);
