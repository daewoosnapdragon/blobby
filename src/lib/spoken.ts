// Pure, client-safe: which strings of a question are read aloud (spec 5.7, ruling R18).
import type { Question, NonWatchQuestion } from './questions/schema';

function own(q: NonWatchQuestion): string[] {
  switch (q.type) {
    case 'listen_tap':
      return [q.prompt, q.audioText, ...q.choices.map((c) => c.text)];
    case 'pick_one':
      return [q.prompt, ...q.choices];
    case 'fill_blank':
      return [`${q.before} … ${q.after}`, ...q.choices];
    case 'find_fix':
      return [q.words.join(' '), ...q.fixes];
    case 'sort_it':
      return [q.prompt, ...q.items.map((i) => i.text)];
    case 'build_it':
      return [q.prompt];
  }
}

/** Every string the "Hear it" button and read-aloud may speak: trimmed, deduped, in order. */
export function spokenStrings(q: Question): string[] {
  const all = q.type === 'watch_answer' ? q.questions.flatMap(own) : own(q);
  return [...new Set(all.map((s) => s.trim()).filter(Boolean))];
}
