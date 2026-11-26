import type { NonWatchQuestion, Response } from './schema';

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** watch_answer is never checked directly; the player expands it into its inner questions. */
export function checkAnswer(q: NonWatchQuestion, r: Response): boolean {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  switch (q.type) {
    case 'listen_tap':
    case 'pick_one':
    case 'fill_blank':
    case 'picture_first':
      return isInt(x.choice) && x.choice === q.answer;
    case 'find_fix':
      return isInt(x.tapped) && isInt(x.fix) && x.tapped === q.wrongIndex && x.fix === q.answer;
    case 'build_it':
      return (
        Array.isArray(x.order) &&
        x.order.length === q.tiles.length &&
        x.order.every((t, i) => t === q.tiles[i])
      );
    case 'sort_it':
      return (
        Array.isArray(x.placement) &&
        x.placement.length === q.items.length &&
        q.items.every((it, i) => x.placement && (x.placement as unknown[])[i] === it.group)
      );
    case 'right_wrong':
      return typeof x.yes === 'boolean' && x.yes === q.right;
    case 'odd_one_out':
      return isInt(x.choice) && x.choice === q.answer;
    case 'tap_all': {
      if (!Array.isArray(x.tapped) || !x.tapped.every(isInt)) return false;
      const tapped = new Set(x.tapped);
      return tapped.size === x.tapped.length && tapped.size === q.answers.length && q.answers.every((a) => tapped.has(a));
    }
    default:
      return false;
  }
}
