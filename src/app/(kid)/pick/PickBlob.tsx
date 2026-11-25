'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Blob, BLOB_HEX } from '@/components/blob/Blob';
import { MiniBlob } from '@/components/blob/MiniBlob';
import { NotYou } from '@/components/auth/NotYou';
import { PillButton } from '@/components/ui/PillButton';
import { Sparkle } from '@/components/ui/icons';
import { WhoAreYouScreen } from '@/components/ui/KidProblems';
import { BLOB_COLOR_KEYS, BLOB_NAMES, type BlobColorKey } from '@/lib/blobColors';
import { postWithRetry } from '@/lib/kidApi';
import { playSound } from '@/lib/sound';
import styles from './pick.module.css';

/** Pick your blob (D-Pick): six radio swatches, the big blob squishes on each change, "That’s me!" saves. */
export function PickBlob({ name, initial }: { name: string; initial: BlobColorKey }) {
  const router = useRouter();
  const [color, setColor] = useState<BlobColorKey>(initial);
  const [changes, setChanges] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(c: BlobColorKey) {
    playSound('pop');
    setColor(c);
    setChanges((n) => n + 1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = (BLOB_COLOR_KEYS.indexOf(color) + step + BLOB_COLOR_KEYS.length) % BLOB_COLOR_KEYS.length;
    choose(BLOB_COLOR_KEYS[i]);
    refs.current[i]?.focus();
  }

  async function save() {
    setBusy(true);
    setError(false);
    const r = await postWithRetry('/api/blob', { color });
    if (r.status === 401) return setSignedOut(true);
    if (r.status !== 200) {
      setError(true);
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (signedOut) return <WhoAreYouScreen />;

  return (
    <main className={styles.screen}>
      <div className={styles.notYou}><NotYou compact /></div>
      <div className={styles.head}>
        <div className={styles.hi}>Hi, {name}!</div>
        <h1 className={styles.title}>Pick your blob</h1>
      </div>

      <div className={styles.stage}>
        <Sparkle size={28} className={styles.sparkle} />
        <button type="button" className={styles.bigBlob} aria-label="Say hi to your blob" onClick={() => { playSound('squeak'); setChanges((n) => n + 1); }}>
          <Blob key={changes} color={color} mood="idle" size="var(--pick-blob, 220px)" reaction={changes ? 'squish' : null} />
        </button>
      </div>

      <div role="radiogroup" aria-label="Blob color" className={styles.swatches} onKeyDown={onKeyDown}>
        {BLOB_COLOR_KEYS.map((c, i) => (
          <button
            key={c}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={BLOB_NAMES[c]}
            tabIndex={c === color ? 0 : -1}
            className={styles.swatch}
            onClick={() => choose(c)}
          >
            <MiniBlob color={c} size={46} />
            <span>{BLOB_NAMES[c]}</span>
          </button>
        ))}
      </div>

      <div className={styles.spacer} />

      <p className={styles.later} role={error ? 'alert' : undefined}>
        {error ? 'That didn’t save. Let’s try again.' : 'You can change it later.'}
      </p>
      <PillButton onClick={save} disabled={busy} arrowColor={BLOB_HEX[color]}>That’s me!</PillButton>
    </main>
  );
}
