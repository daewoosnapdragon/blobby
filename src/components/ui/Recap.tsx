import { tallyLines, type Tally } from '@/lib/tally';
import s from './ui.module.css';

const TINTS = [s.recapYellow, s.recapMint, s.recapBlue];

/** Up to three pastel tags saying what the kid did this session. Renders nothing for an empty tally. */
export function Recap({ tally }: { tally: Tally | null | undefined }) {
  const lines = tally ? tallyLines(tally) : [];
  if (lines.length === 0) return null;
  return (
    <ul data-testid="recap" className={s.recap}>
      {lines.map((line, i) => (
        <li key={line} className={`${s.recapTag} ${TINTS[i % TINTS.length]}`}>{line}</li>
      ))}
    </ul>
  );
}
