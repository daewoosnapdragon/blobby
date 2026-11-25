'use client';
import { useEffect, useState } from 'react';
import { Blob, type BlobColor, type Hat } from '@/components/blob/Blob';
import { prefersReducedMotion, useNudge } from '@/components/blob/useNudge';
import { playSound } from '@/lib/sound';
import styles from './home.module.css';

const STRETCH_MS = 1800;

/**
 * The blob peeking from the "this week" card; poking it makes it squish (D-Home) and smile for a moment.
 * Scene: the seasonal hat, pajamas at bedtime, and a sleepy stretch once early in the morning (not under reduced motion).
 */
export function PokeBlob({ color, hat = null }: { color: BlobColor; hat?: Hat | null }) {
  const [pokes, setPokes] = useState(0);
  const [happy, setHappy] = useState(false);
  const [stretch, setStretch] = useState(false);
  const nudge = useNudge();
  useEffect(() => {
    if (!pokes) return;
    setHappy(true);
    const t = setTimeout(() => setHappy(false), 1200);
    return () => clearTimeout(t);
  }, [pokes]);
  useEffect(() => {
    if (nudge !== 'morning' || prefersReducedMotion()) return;
    try { if (sessionStorage.getItem('blobby-stretched')) return; } catch {}
    setStretch(true);
    const t = setTimeout(() => {
      setStretch(false);
      try { sessionStorage.setItem('blobby-stretched', '1'); } catch {} // once per visit, not on every return to home
    }, STRETCH_MS);
    return () => { clearTimeout(t); setStretch(false); };
  }, [nudge]);
  const mood = happy ? 'happy' : stretch ? 'sleepy' : 'idle';
  return (
    <button type="button" className={styles.poke} aria-label="Say hi to your blob" onClick={() => { playSound('squeak'); setPokes((n) => n + 1); }}>
      <Blob key={pokes} color={color} mood={mood} size="var(--hero-blob, 196px)" reaction={pokes ? 'squish' : null} hat={hat} accessory={nudge === 'bedtime' ? 'pajamas' : null} />
    </button>
  );
}
