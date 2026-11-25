'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NonWatchQuestion, Question } from '@/lib/questions/schema';
import { spokenStrings } from '@/lib/spoken';
import { Blob, type BlobColor, type Mood, type Reaction } from '@/components/blob/Blob';
import { HearIt } from '@/components/ui/HearIt';
import { PillButton } from '@/components/ui/PillButton';
import { ListenTap } from './ListenTap';
import { PickOne } from './PickOne';
import { FindFix } from './FindFix';
import { BuildIt } from './BuildIt';
import { SortIt } from './SortIt';
import { FillBlank } from './FillBlank';
import { TopBar } from './TopBar';
import type { Status } from './types';
import s from './questions.module.css';

export type PlayerQuestion = {
  /** the wp_questions id; attempts are recorded under it (for watch_answer, the parent's id) */
  id: string;
  question: Question;
  /** spoken text -> audio URL (wp_questions.audio) */
  audio?: Record<string, string>;
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
  /** the number on the star counter */
  stars: number;
  /** Grades 1–2: read the prompt aloud as each question appears (spec 5.7) */
  autoRead?: boolean;
  /** stars per first-try right answer, shown on the right card ("+1 star"); 0 in lessons */
  answerStars?: number;
  closeHref?: string;
};

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
  questions, onAnswer, onFinish, blobColor, stars, autoRead = false, answerStars = 0, closeHref = '/',
}: QuestionPlayerProps) {
  const steps = useMemo(
    () =>
      questions.flatMap((pq) =>
        pq.question.type === 'watch_answer'
          ? pq.question.questions.map((inner, i) => ({ key: `${pq.id}:${i}`, id: pq.id, question: inner, audio: pq.audio ?? {} }))
          : [{ key: pq.id, id: pq.id, question: pq.question as NonWatchQuestion, audio: pq.audio ?? {} }],
      ),
    [questions],
  );
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [firstTry, setFirstTry] = useState(true);
  const [rightFirst, setRightFirst] = useState(false);
  const [reaction, setReaction] = useState<{ kind: Reaction; n: number } | null>(null);
  const [found, setFound] = useState(false);
  const actionRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => {
    if (status !== 'idle') actionRef.current?.focus({ preventScroll: true });
  }, [status]);

  if (!step) return null;
  const q = step.question;

  function answer(correct: boolean) {
    if (status !== 'idle') return;
    if (firstTry) {
      onAnswer({ id: step.id, question: q }, correct);
      setRightFirst(correct);
      setFirstTry(false);
    }
    setStatus(correct ? 'right' : 'wrong');
    setReaction((r) => ({ kind: correct ? 'hop' : 'wobble', n: (r?.n ?? 0) + 1 }));
  }

  function next() {
    if (index + 1 >= steps.length) {
      onFinish();
      return;
    }
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
      <TopBar closeHref={closeHref} current={index + 1} total={steps.length} stars={stars} />

      <section className={s.qCard} aria-labelledby="q-ask">
        <span className={s.tag} style={{ background: TYPE_TINT[q.type] }}>{TYPE_LABEL[q.type]}</span>
        <div className={s.qRow}>
          <div className={s.qBlob}>
            <Blob key={reaction?.n ?? 0} color={blobColor} mood={mood} size={136} reaction={reaction?.kind ?? null} />
          </div>
          <div className={s.bubble}>
            {/* Both lines share one grid cell, so the card keeps its height when the words change. */}
            <div className={s.askStack}>
              <div id="q-ask" className={s.ask}>{bubble}</div>
              <div className={s.ask} aria-hidden="true" style={{ visibility: 'hidden' }}>{ask(q, found)}</div>
            </div>
            <HearIt key={step.key + index} texts={aloud.all} audio={step.audio} autoPlay={autoRead} autoPlayTexts={aloud.auto} />
          </div>
        </div>
      </section>

      <div key={step.key + index} className={s.body}>
        <Body q={q} status={status} onAnswer={answer} onFound={setFound} />
      </div>

      <div className={s.spacer} />

      <div role="status" aria-live="polite" className={s.feedbackSlot}>
        {status === 'right' ? (
          <div className={`${s.feedback} ${s.right}`}>
            <div className={s.feedbackText}>
              <div className={s.feedbackTitle}>That’s it!</div>
              {answerStars > 0 && rightFirst ? (
                <div className={s.feedbackNote}>+{answerStars} {answerStars === 1 ? 'star' : 'stars'}</div>
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
            <button type="button" className={s.tryAgain} onClick={() => setStatus('idle')} ref={actionRef}>Try again</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
