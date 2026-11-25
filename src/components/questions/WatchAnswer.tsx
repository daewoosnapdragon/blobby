'use client';
import { useEffect, useRef, useState } from 'react';
import { PillButton } from '@/components/ui/PillButton';
import { markActive } from '@/components/usePracticePing';
import w from './watch.module.css';

const ORIGIN = 'https://www.youtube-nocookie.com';
const LOAD_TIMEOUT_MS = 8_000;
const PLAYING = 1;

export function embedUrl(id: string): string {
  return `${ORIGIN}/embed/${id}?rel=0&modestbranding=1&enablejsapi=1&playsinline=1`;
}

function parse(data: unknown): { event?: string; info?: unknown } | null {
  try {
    const v = typeof data === 'string' ? JSON.parse(data) : data;
    return v && typeof v === 'object' ? (v as { event?: string; info?: unknown }) : null;
  } catch {
    return null;
  }
}

/**
 * The video step of watch-and-answer. Never blocks anything: Next is always there, and Skip video shows up
 * when the player can't be used (no load in 8s, the player reports an error, or the device is offline).
 * While the player says "playing", watching counts as practice time (markActive).
 */
export function WatchAnswer({ youtubeId, onDone }: { youtubeId: string; onDone: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const loaded = useRef(false);
  const playing = useRef(false);
  const [slow, setSlow] = useState(false);
  const [errored, setErrored] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const t = setTimeout(() => { if (!loaded.current) setSlow(true); }, LOAD_TIMEOUT_MS);
    const off = () => setOffline(true);
    const on = () => setOffline(false);
    window.addEventListener('offline', off);
    window.addEventListener('online', on);

    function onMessage(e: MessageEvent) {
      if (e.origin !== ORIGIN || !frame.current || e.source !== frame.current.contentWindow) return;
      const m = parse(e.data);
      if (!m) return;
      loaded.current = true;
      setSlow(false);
      if (m.event === 'onError') {
        playing.current = false;
        setErrored(true);
      } else if (m.event === 'onStateChange' && typeof m.info === 'number') {
        playing.current = m.info === PLAYING;
        if (playing.current) markActive();
      } else if (m.event === 'infoDelivery' && m.info && typeof m.info === 'object') {
        const st = (m.info as { playerState?: unknown }).playerState;
        if (typeof st === 'number') playing.current = st === PLAYING;
        if (playing.current) markActive();
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      clearTimeout(t);
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  function onLoad() {
    // The iframe's load event also fires for a browser error page, so only a message from the player proves it works.
    // Ask the player to send its state events (the IFrame API's postMessage handshake).
    try {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), ORIGIN);
    } catch {
      // the video just won't count as practice time
    }
  }

  const broken = errored || offline;
  const showSkip = broken || slow;
  return (
    <div className={w.watch}>
      <span className={w.tag}>Watch the video</span>
      <div className={w.card}>
        {broken ? null : (
          <iframe
            ref={frame}
            className={w.frame}
            src={embedUrl(youtubeId)}
            title="Video for this lesson"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={onLoad}
          />
        )}
        {showSkip ? (
          <div className={w.problem} role="status">
            {broken ? (
              <p className={w.problemText}>{offline ? 'You’re offline, so the video can’t play.' : 'This video can’t play.'}</p>
            ) : (
              <p className={w.problemText}>The video is taking a while.</p>
            )}
          </div>
        ) : null}
      </div>
      <div className={w.actions}>
        {showSkip ? <button type="button" className={w.skip} onClick={onDone}>Skip video</button> : null}
        <PillButton onClick={onDone}>Next</PillButton>
      </div>
    </div>
  );
}
