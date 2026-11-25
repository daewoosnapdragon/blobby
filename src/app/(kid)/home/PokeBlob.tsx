'use client';
import { useEffect, useState } from 'react';
import { Blob, type BlobColor } from '@/components/blob/Blob';
import styles from './home.module.css';

/** The blob peeking from the "this week" card; poking it makes it squish (D-Home) and smile for a moment. */
export function PokeBlob({ color }: { color: BlobColor }) {
  const [pokes, setPokes] = useState(0);
  const [happy, setHappy] = useState(false);
  useEffect(() => {
    if (!pokes) return;
    setHappy(true);
    const t = setTimeout(() => setHappy(false), 1200);
    return () => clearTimeout(t);
  }, [pokes]);
  return (
    <button type="button" className={styles.poke} aria-label="Say hi to your blob" onClick={() => setPokes((n) => n + 1)}>
      <Blob key={pokes} color={color} mood={happy ? 'happy' : 'idle'} size={196} reaction={pokes ? 'squish' : null} />
    </button>
  );
}
