'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Blob, type BlobColor } from '@/components/blob/Blob';
import { PillArrow } from '@/components/ui/ProblemScreen';
import { koJoin } from '@/lib/copy.ko';
import styles from './join.module.css';

const COLORS: BlobColor[] = ['sunny', 'peach', 'pink', 'mint', 'sky', 'grape'];
type Name = { id: string; displayName: string; blobColor: string | null };

export const joinCopy = {
  title: 'Find your name',
  codeLabel: 'Class code',
  codeHint: 'Ask your teacher for the 6-letter code.',
  next: 'Next',
  unknownCode: "We couldn't find that code. Check it and try again.",
  networkError: "Something went wrong. Let's try again.",
  pickName: 'Tap your name',
  back: 'Different code',
};

function normalizeCode(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function asColor(c: string | null): BlobColor | null {
  return COLORS.includes(c as BlobColor) ? (c as BlobColor) : null;
}

export function JoinFlow() {
  const router = useRouter();
  // Uncontrolled on purpose: a kid can type before the page hydrates, and React must not wipe what they typed.
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [names, setNames] = useState<Name[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function syncCode() {
    const el = inputRef.current;
    if (!el) return '';
    const clean = normalizeCode(el.value);
    if (el.value !== clean) el.value = clean;
    setCode(clean);
    return clean;
  }

  // Pick up anything typed before hydration.
  useEffect(() => { syncCode(); }, []);

  async function post(body: object) {
    return fetch('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const typed = syncCode();
    if (typed.length !== 6) return;
    setBusy(true);
    try {
      const res = await post({ code: typed });
      if (res.status === 404 || res.status === 400) setError(joinCopy.unknownCode);
      else if (!res.ok) setError(joinCopy.networkError);
      else setNames((await res.json()).names);
    } catch {
      setError(joinCopy.networkError);
    } finally {
      setBusy(false);
    }
  }

  async function choose(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await post({ code, studentId: id });
      if (!res.ok) throw new Error('join failed');
      const { next } = await res.json();
      router.push(next);
      router.refresh();
    } catch {
      setError(joinCopy.networkError);
      setBusy(false);
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.parent} lang="ko">
        {koJoin.parentHelp.map((l) => <p key={l}>{l}</p>)}
      </div>
      <div className={styles.card}>
        <Blob color="sunny" mood="idle" size="var(--join-blob, 110px)" />
        <h1 className={styles.title}>{joinCopy.title}</h1>
        {names ? (
          <>
            <p className={styles.hint}>{joinCopy.pickName}</p>
            <ul className={styles.chips}>
              {names.map((n) => {
                const color = asColor(n.blobColor);
                return (
                  <li key={n.id}>
                    <button type="button" className={styles.chip} disabled={busy} onClick={() => choose(n.id)}>
                      {color ? <Blob color={color} mood="idle" size={32} /> : <span className={styles.dot} aria-hidden="true" />}
                      <span>{n.displayName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className={styles.link} onClick={() => { setNames(null); setError(null); }}>{joinCopy.back}</button>
          </>
        ) : (
          <form className={styles.form} onSubmit={submitCode}>
            <label htmlFor="code" className={styles.label}>{joinCopy.codeLabel}</label>
            <input
              id="code"
              className={styles.input}
              ref={inputRef}
              onChange={syncCode}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              aria-describedby="code-hint"
            />
            <p id="code-hint" className={styles.hint}>{joinCopy.codeHint}</p>
            <button type="submit" className={styles.pill} disabled={busy || code.length !== 6}>
              {joinCopy.next}
              <PillArrow />
            </button>
          </form>
        )}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
    </main>
  );
}
