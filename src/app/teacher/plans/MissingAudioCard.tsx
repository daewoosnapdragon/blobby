'use client';
import { useRef, useState } from 'react';
import { makeMissingAudio } from '../audioActions';
import t from '../teacher.module.css';
import s from './plans.module.css';

const FAILED = "Couldn't make audio just now. What's made is saved. Try again in a minute.";
const STUCK = "Couldn't make progress just now. What's made is saved. Try again in a minute.";

const countLine = (n: number) =>
  n === 0 ? 'All sentences have audio' : `${n} ${n === 1 ? 'sentence has' : 'sentences have'} no audio yet`;

/** Makes the read-aloud audio that SQL-loaded questions lack, 20 sentences per call, until none remain or Stop. */
export function MissingAudioCard({ initialRemaining }: { initialRemaining: number }) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [made, setMade] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function run() {
    stopRef.current = false;
    setRunning(true);
    setStopping(false);
    setError(null);
    let total = 0;
    setMade(0);
    try {
      for (;;) {
        const r = await makeMissingAudio();
        total += r.done;
        setMade(total);
        setRemaining(r.remaining);
        if (r.error) { setError(FAILED); break; }
        if (r.remaining === 0 || stopRef.current) break;
        // nothing made and nothing wrong, yet some left (e.g. those rows keep being edited): don't spin
        if (r.done === 0) { setError(STUCK); break; }
      }
    } catch {
      setError(FAILED);
    } finally {
      setRunning(false);
      setStopping(false);
    }
  }

  function stop() {
    stopRef.current = true;
    setStopping(true);
  }

  return (
    <section className={`${t.card} ${s.audioCard}`} aria-labelledby="audio-card-title">
      <h2 id="audio-card-title" className={t.h2}>Read-aloud audio</h2>
      <p className={s.audioCount}>{countLine(remaining)}</p>
      {made !== null ? <p className={s.audioProgress} aria-live="polite">Made {made} so far, {remaining} to go</p> : null}
      {error ? <p role="alert" className={t.error}>{error}</p> : null}
      {remaining > 0 || running ? (
        <div className={s.audioButtons}>
          <button type="button" className={t.solid} onClick={run} disabled={running} aria-busy={running}>Make missing audio</button>
          {running ? (
            <button type="button" className={t.ghost} onClick={stop} disabled={stopping}>{stopping ? 'Stopping…' : 'Stop'}</button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
