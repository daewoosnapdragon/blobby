'use client';
import { useEffect, useRef, useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { pictureSrc } from '@/lib/pictures';
import { MarkIcon } from './Marks';
import type { QProps } from './types';
import s from './questions.module.css';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Picture first: a big picture, then 2–4 words or phrases; the kid taps the one that matches it. */
export function PictureFirst({ q, status, onAnswer }: QProps<'picture_first'>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  // Bumped by Try again: a new query string makes the browser fetch the picture again.
  const [retry, setRetry] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  // A server-rendered img can fail before React hydrates; that error event is never replayed, and the browser would
  // draw the alt (the answer) as text. So check on mount. An SVG with only a viewBox can report naturalWidth 0 even
  // when it loaded, so decode() confirms where the browser has it.
  useEffect(() => {
    const el = img.current;
    if (!el || !el.complete || el.naturalWidth !== 0) return;
    let live = true;
    if (typeof el.decode === 'function') el.decode().catch(() => { if (live) setBroken(true); });
    else setBroken(true);
    return () => { live = false; };
  }, [retry]);
  const locked = status !== 'idle';
  function choose(i: number) {
    if (locked) return;
    setPicked(i);
    onAnswer(checkAnswer(q, { choice: i }));
  }
  const src = retry ? `${pictureSrc(q.picture)}?retry=${retry}` : pictureSrc(q.picture);
  return (
    <div className={s.stack}>
      <div className={s.bigPicture}>
        {broken ? (
          // Never the picture's name as text: that would give the answer away.
          <div className={s.pictureMissing}>
            <p>The picture didn’t load</p>
            <button type="button" className={s.tryAgain} onClick={() => { setRetry((n) => n + 1); setBroken(false); }}>Show it again</button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- small static SVGs from /public
          <img key={retry} ref={img} src={src} alt={q.picture.replace(/-/g, ' ')} width={160} height={160} draggable={false} onError={() => setBroken(true)} />
        )}
      </div>
      <div className={s.options} data-short={q.choices.every((c) => c.length <= 18) ? '' : undefined}>
        {q.choices.map((c, i) => {
          const mark = locked && picked === i ? status : undefined;
          return (
            <button key={i} type="button" className={s.option} data-mark={mark} aria-disabled={locked || undefined} onClick={() => choose(i)}>
              <span className={s.letter} aria-hidden="true">{mark ? <MarkIcon mark={mark} /> : LETTERS[i]}</span>
              <span>{c}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
