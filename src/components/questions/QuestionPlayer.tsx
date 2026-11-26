'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NonWatchQuestion, Question } from '@/lib/questions/schema';
import { spokenStrings } from '@/lib/spoken';
import { playSound } from '@/lib/sound';
import { Blob, type BlobColor, type Hat, type Mood, type Reaction } from '@/components/blob/Blob';
import { useNudge } from '@/components/blob/useNudge';
import { HearIt } from '@/components/ui/HearIt';
import { PillButton } from '@/components/ui/PillButton';
import { StarIcon, STAR_PATH } from '@/components/ui/icons';
import { ListenTap } from './ListenTap';
import { PickOne } from './PickOne';
import { FindFix } from './FindFix';
import { BuildIt } from './BuildIt';
import { SortIt } from './SortIt';
import { FillBlank } from './FillBlank';
import { TopBar } from './TopBar';
import { WatchAnswer } from './WatchAnswer';
import { QuestionPicture } from './QuestionPicture';
import type { Status } from './types';
import s from './questions.module.css';

export type PlayerQuestion = {
  /** the wp_questions id; attempts are recorded under it (for watch_answer, the parent's id) */
  id: string;
  question: Question;
  /** spoken text -> audio URL (wp_questions.audio) */
  audio?: Record<string, string>;
  /** a review-track question chosen for this kid */
  forYou?: boolean;
};

/** One answerable step: watch_answer is expanded into its inner questions. */
export type AnsweredQuestion = { id: string; question: NonWatchQuestion };

export type QuestionPlayerProps = {
  questions: PlayerQuestion[];
  /** the FIRST try at each step only; later tries are practice and not reported */
  onAnswer: (q: AnsweredQuestion, correct: boolean) => void;
  /** after Next on the last step */
  onFinish: () => void;
  blobColor: BlobColor;
  /** seasonal hat for the kid's own blob (Seoul date, from the server) */
  hat?: Hat | null;
  /** the number on the star counter */
  stars: number;
  /** Grades 1–2: read the prompt aloud as each question appears (spec 5.7) */
  autoRead?: boolean;
  /** stars per first-try right answer, shown on the right card ("+1 star"); 0 in lessons */
  answerStars?: number;
  closeHref?: string;
  /** the close button's accessible name */
  closeLabel?: string;
  /** no top bar: the teacher's editor preview shows just the question */
  bare?: boolean;
};

/** A video step (watch_answer's first step) or one answerable question. */
type Step = { key: string; id: string; forYou?: boolean } & ({ video: string; question?: undefined; audio?: undefined } | { question: NonWatchQuestion; audio: Record<string, string>; video?: undefined });

const TYPE_LABEL: Record<NonWatchQuestion['type'], string> = {
  listen_tap: 'Listen and tap',
  pick_one: 'Pick the right one',
  find_fix: 'Find and fix',
  build_it: 'Build it',
  sort_it: 'Sort it',
  fill_blank: 'Fill the blank',
};
const TYPE_TINT: Record<NonWatchQuestion['type'], string> = {
  listen_tap: '#A9D3FF',
  pick_one: '#B7E1D1',
  find_fix: '#FFB5C1',
  build_it: '#FFE59A',
  sort_it: '#A9D3FF',
  fill_blank: '#B7E1D1',
};
const HINT: Record<NonWatchQuestion['type'], string> = {
  listen_tap: 'Listen again, then look at each word.',
  pick_one: 'Read each sentence slowly.',
  find_fix: 'Look closely at each word.',
  build_it: 'Check the order of the words.',
  sort_it: 'Look at each word again.',
  fill_blank: 'Try each word in the sentence.',
};

function ask(q: NonWatchQuestion, found: boolean): string {
  switch (q.type) {
    case 'fill_blank':
      return 'Which word fits?';
    case 'find_fix':
      return found ? 'Now pick the fix.' : 'Tap the mistake.';
    default:
      return q.prompt;
  }
}

/** What Hear it reads, and what autoplay reads. listen_tap never reads its choices: that would give the answer away. */
function readAloud(q: NonWatchQuestion): { all: string[]; auto: string[] } {
  if (q.type === 'listen_tap') {
    const t = [q.prompt.trim(), q.audioText.trim()];
    return { all: t, auto: t };
  }
  const all = spokenStrings(q);
  return { all, auto: all.slice(0, 1) };
}

/** Pop for a tap on an enabled button inside the answer area. */
function popOnTap(e: React.MouseEvent) {
  const b = (e.target as HTMLElement).closest('button');
  if (b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled) playSound('pop');
}

function Body({ q, status, onAnswer, onFound }: { q: NonWatchQuestion; status: Status; onAnswer: (c: boolean) => void; onFound: (f: boolean) => void }) {
  switch (q.type) {
    case 'listen_tap': return <ListenTap q={q} status={status} onAnswer={onAnswer} />;
    case 'pick_one': return <PickOne q={q} status={status} onAnswer={onAnswer} />;
    case 'find_fix': return <FindFix q={q} status={status} onAnswer={onAnswer} onFound={onFound} />;
    case 'build_it': return <BuildIt q={q} status={status} onAnswer={onAnswer} />;
    case 'sort_it': return <SortIt q={q} status={status} onAnswer={onAnswer} />;
    case 'fill_blank': return <FillBlank q={q} status={status} onAnswer={onAnswer} />;
  }
}

/**
 * Plays questions one at a time: immediate feedback, retry until right, Next. Reused by lessons (Task 8),
 * free practice (Task 12) and watch-and-answer (Task 14).
 */
export function QuestionPlayer({
  questions, onAnswer, onFinish, blobColor, hat = null, stars, autoRead = false, answerStars = 0, closeHref = '/', closeLabel = 'Close lesson', bare = false,
}: QuestionPlayerProps) {
  const nudge = useNudge();
  const steps = useMemo(
    () =>
      questions.flatMap((pq): Step[] => {
        const audio = pq.audio ?? {};
        const wa = pq.question;
        if (wa.type === 'watch_answer') {
          return [
            { key: `${pq.id}:video`, id: pq.id, video: wa.youtubeId },
            ...wa.questions.map((inner, i) => ({ key: `${pq.id}:${i}`, id: pq.id, question: inner, audio })),
          ];
        }
        return [{ key: pq.id, id: pq.id, question: wa, audio, forYou: pq.forYou }];
      }),
    [questions],
  );
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [firstTry, setFirstTry] = useState(true);
  const [rightFirst, setRightFirst] = useState(false);
  const [reaction, setReaction] = useState<{ kind: Reaction; n: number } | null>(null);
  const [found, setFound] = useState(false);
  const actionRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const noteStar = useRef<HTMLSpanElement>(null);
  const flyer = useRef<SVGSVGElement>(null);
  // Set when the focused button is about to unmount (Try again, Next): focus goes to the prompt so it's read out.
  const focusAsk = useRef(false);

  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => {
    if (status !== 'idle') actionRef.current?.focus({ preventScroll: true });
    else if (focusAsk.current) {
      focusAsk.current = false;
      askRef.current?.focus({ preventScroll: true });
    }
  }, [status, index]);

  // A first-try right answer with a star on it: the star flies from the card to the counter (transform only;
  // skipped under reduced motion, where the note and the counter say it).
  const flies = status === 'right' && rightFirst && answerStars > 0;
  useEffect(() => {
    if (!flies) return;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    const el = flyer.current;
    if (reduce || !el || typeof el.animate !== 'function') return;
    let anim: Animation | undefined;
    // wait for the feedback card to finish popping in, so the star starts where the card really is
    const t = setTimeout(() => {
      const from = noteStar.current?.getBoundingClientRect();
      const to = pillRef.current?.querySelector('svg')?.getBoundingClientRect();
      if (!from || !to) return;
      el.style.left = `${from.left + from.width / 2 - 11}px`;
      el.style.top = `${from.top + from.height / 2 - 11}px`;
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      anim = el.animate(
        [
          { transform: 'translate(0, 0) scale(0.7)', visibility: 'visible' },
          { transform: `translate(${dx * 0.15}px, -30px) scale(1.2)`, offset: 0.3, visibility: 'visible' },
          { transform: `translate(${dx}px, ${dy}px) scale(0.8)`, visibility: 'visible' },
        ],
        { duration: 700, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'both' },
      );
      anim.finished.then(() => anim?.cancel()).catch(() => {});
    }, 260);
    return () => { clearTimeout(t); anim?.cancel(); };
  }, [flies, index]);

  if (!step) return null;
  // Progress counts the questions only; the video step sits before the first one.
  const qSteps = steps.filter((x) => x.question);
  const done = steps.slice(0, index).filter((x) => x.question).length;
  if (!step.question) {
    return (
      <div className={s.screen}>
        {bare ? null : <TopBar closeHref={closeHref} closeLabel={closeLabel} starsRef={pillRef} current={done} total={qSteps.length} stars={stars}
          label={`Watch the video, then ${qSteps.length} ${qSteps.length === 1 ? 'question' : 'questions'}`} />}
        <div className={s.main}>
          <WatchAnswer key={step.key} youtubeId={step.video} onDone={next} />
        </div>
      </div>
    );
  }
  const q = step.question;

  function answer(correct: boolean) {
    if (status !== 'idle') return;
    if (firstTry) {
      onAnswer({ id: step.id, question: q }, correct);
      setRightFirst(correct);
      setFirstTry(false);
    }
    setStatus(correct ? 'right' : 'wrong');
    // The tap's pop (~80 ms) finishes first, then the result sound.
    setTimeout(() => playSound(correct ? 'ding' : 'boop'), 90);
    setReaction((r) => ({ kind: correct ? 'hop' : 'wobble', n: (r?.n ?? 0) + 1 }));
  }

  function next() {
    if (index + 1 >= steps.length) {
      onFinish();
      return;
    }
    focusAsk.current = true;
    setIndex(index + 1);
    setStatus('idle');
    setFirstTry(true);
    setRightFirst(false);
    setReaction(null);
    setFound(false);
  }

  const mood: Mood = status === 'right' ? 'happy' : status === 'wrong' ? 'oops' : 'idle';
  const bubble = status === 'right' ? 'Yes! You got it.' : status === 'wrong' ? 'Hmm, not that one.' : ask(q, found);
  const aloud = readAloud(q);

  return (
    <div className={s.screen}>
      {bare ? null : <TopBar closeHref={closeHref} closeLabel={closeLabel} starsRef={pillRef} current={done + 1} total={qSteps.length} stars={stars} />}

      {/* phone: fills the screen, feedback at the bottom (D-Question). Wider: a centered column, feedback right under the answers. */}
      <div className={s.main}>
        <section className={s.qCard} aria-labelledby="q-ask">
          <span className={s.tags}>
            <span className={s.tag} style={{ background: TYPE_TINT[q.type] }}>{TYPE_LABEL[q.type]}</span>
            {step.forYou ? <span className={`${s.tag} ${s.forYou}`}>Just for you</span> : null}
          </span>
          <div className={s.qRow}>
            <div className={s.qBlob}>
              <Blob key={reaction?.n ?? 0} color={blobColor} mood={mood} size="var(--q-blob, 136px)" reaction={reaction?.kind ?? null} hat={hat} accessory={nudge === 'bedtime' ? 'pajamas' : null} />
            </div>
            <div className={s.bubble}>
              <QuestionPicture key={step.key} name={q.picture} className={s.qPicture} />
              {/* Both lines share one grid cell, so the card keeps its height when the words change. */}
              <div className={s.askStack}>
                <div id="q-ask" ref={askRef} tabIndex={-1} className={s.ask}>{bubble}</div>
                <div className={s.ask} aria-hidden="true" style={{ visibility: 'hidden' }}>{ask(q, found)}</div>
              </div>
              {/* No audio made for this question (read-aloud is off for now): no button, rather than one that only says "Try again". */}
              {aloud.all.some((t) => step.audio?.[t]) ? (
                <HearIt key={step.key + index} texts={aloud.all} audio={step.audio ?? {}} autoPlay={autoRead} autoPlayTexts={aloud.auto} />
              ) : null}
            </div>
          </div>
        </section>

        {/* A soft pop on every answer tap (words, tiles, choices). Hear it sits outside this box, so read-aloud is never popped over. */}
        <div key={step.key + index} className={s.body} onClickCapture={popOnTap}>
          <Body q={q} status={status} onAnswer={answer} onFound={setFound} />
        </div>

        <div className={s.spacer} />

        <div role="status" aria-live="polite" className={s.feedbackSlot}>
          {status === 'right' ? (
            <div className={`${s.feedback} ${s.right}`}>
              <div className={s.feedbackText}>
                <div className={s.feedbackTitle}>That’s it!</div>
                {answerStars > 0 && rightFirst ? (
                  <div className={s.feedbackNote}>
                    <span ref={noteStar} className={s.noteStar}><StarIcon size={16} /></span>
                    +{answerStars} {answerStars === 1 ? 'star' : 'stars'}
                  </div>
                ) : null}
              </div>
              <PillButton size="sm" onClick={next} ref={actionRef}>Next</PillButton>
            </div>
          ) : status === 'wrong' ? (
            <div className={`${s.feedback} ${s.wrong}`}>
              <div className={s.feedbackText}>
                <div className={s.feedbackTitle}>Almost!</div>
                <div className={s.feedbackNote} data-hint="">{HINT[q.type]}</div>
              </div>
              <button type="button" className={s.tryAgain} onClick={() => { focusAsk.current = true; setStatus('idle'); }} ref={actionRef}>Try again</button>
            </div>
          ) : null}
        </div>
      </div>

      {flies ? (
        <svg ref={flyer} className={s.flyer} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR_PATH} fill="#FFD95A" stroke="#1F1F1F" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
}
