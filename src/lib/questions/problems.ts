// Turns validation failures into sentences a teacher can act on. Pure and client-safe.
import { questionSchema } from './schema';

const LABEL: Record<string, string> = {
  prompt: 'Prompt', audioText: 'Spoken word', choices: 'Choice', answer: 'Right answer', words: 'Sentence',
  wrongIndex: 'Wrong word', fixes: 'Fix', tiles: 'Tile', distractors: 'Extra tile', groups: 'Group',
  items: 'Word', before: 'Text before the blank', after: 'Text after the blank', youtubeId: 'Video', text: 'Text',
  sentence: 'Sentence', right: 'Right or not',
};
/** Labels that differ for one type: odd one out's `words` are separate words, not a sentence. */
const TYPE_FIELD_LABEL: Record<string, Record<string, string>> = { odd_one_out: { words: 'Word' } };
const PLURAL: Record<string, string> = { choices: 'choices', fixes: 'fixes', tiles: 'tiles', groups: 'groups', items: 'words', words: 'words', questions: 'questions' };

function where(path: PropertyKey[], type: string): string {
  const parts: string[] = [];
  let i = 0;
  if (path[0] === 'questions' && typeof path[1] === 'number') { parts.push(`Question ${path[1] + 1}`); i = 2; }
  const rest = path.slice(i).filter((p) => p !== 'type');
  const [field, n, sub] = rest;
  if (field === undefined) return parts.join(', ');
  let label = TYPE_FIELD_LABEL[type]?.[String(field)] ?? LABEL[String(field)] ?? String(field);
  if (typeof n === 'number') label += ` ${n + 1}`;
  if (sub === 'group') label += ' group';
  parts.push(label);
  return parts.join(', ');
}

/** The type of the question an issue is about: an inner question's own type inside watch and answer. */
function issueType(type: string, body: object, path: PropertyKey[]): string {
  if (path[0] !== 'questions' || typeof path[1] !== 'number') return type;
  const inner = (body as { questions?: unknown }).questions;
  const t = Array.isArray(inner) ? (inner[path[1]] as { type?: unknown } | undefined)?.type : undefined;
  return typeof t === 'string' ? t : type;
}

/** Readable problems with this question, or an empty list when it is valid. */
export function questionProblems(type: string, payload: unknown): string[] {
  const body = payload && typeof payload === 'object' ? { ...(payload as object), type } : { type };
  const r = questionSchema.safeParse(body);
  if (r.success) return [];
  const out: string[] = [];
  for (const issue of r.error.issues) {
    const path = issue.path;
    const last = path[path.length - 1];
    const field = path.filter((p) => typeof p === 'string' && p !== 'type').pop() as string | undefined;
    const qType = issueType(type, body, path);
    let msg: string;
    if (issue.code === 'invalid_union' || (path.length === 1 && path[0] === 'type')) msg = 'Pick a question type.';
    else if (last === 'right') msg = 'Pick Yes or No.';
    else if (last === 'answer' && qType === 'odd_one_out') msg = 'Pick the odd one.';
    else if (last === 'answer' || last === 'wrongIndex') msg = last === 'answer' ? 'Pick the right answer.' : 'Pick the wrong word.';
    else if (issue.code === 'too_small' && (issue as { origin?: string }).origin === 'array') {
      const min = Number((issue as { minimum?: number }).minimum ?? 1);
      const noun = PLURAL[field ?? ''] ?? 'items';
      const inQ = path[0] === 'questions' && typeof path[1] === 'number' && path.length > 2;
      msg = `${inQ ? `Question ${(path[1] as number) + 1}: add` : 'Add'} at least ${min} ${noun}.`;
    } else if (issue.message === 'must not be empty' || (issue.code === 'too_small' && (issue as { origin?: string }).origin === 'string')) msg = `${where(path, qType)}: fill this in.`;
    else if (field === 'youtubeId') msg = 'Video: paste a YouTube link or the 11-character video id.';
    else if (typeof last === 'string' && last === 'before') msg = 'Add text before or after the blank.';
    else msg = `${where(path, qType)}: ${issue.message}.`.replace(/\.\.$/, '.');
    out.push(msg.replace(/^: /, ''));
  }
  return [...new Set(out)];
}
