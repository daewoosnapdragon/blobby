'use client';
import { useEffect, useMemo, useState } from 'react';
import { pictureSrc, searchPictures, suggestPictures, type PictureEntry } from '@/lib/pictures';
import s from './editor.module.css';

let catalogPromise: Promise<PictureEntry[]> | null = null;
/** The picture list, fetched once per page (about 150 KB) and only when a form is open. */
function loadCatalog(): Promise<PictureEntry[]> {
  catalogPromise ??= fetch('/pictures/catalog.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return catalogPromise;
}

function Thumb({ p, onPick }: { p: PictureEntry; onPick: (name: string) => void }) {
  return (
    <button type="button" className={s.picBtn} onClick={() => onPick(p.n)} aria-label={`Use the ${p.l} picture`} title={p.l}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pictureSrc(p.n)} alt="" width={44} height={44} loading="lazy" />
    </button>
  );
}

/** Picture box in the question form: the chosen picture, suggestions from the question's words, and a keyword search. */
export function PicturePicker({ text, value, onChange, catalog: given }: {
  /** the question's words, for suggestions */ text: string;
  /** the chosen picture name, '' for none */ value: string;
  onChange: (name: string) => void;
  /** tests pass the list; the app fetches it */ catalog?: PictureEntry[];
}) {
  const [catalog, setCatalog] = useState<PictureEntry[]>(given ?? []);
  const [query, setQuery] = useState('');
  useEffect(() => { if (!given) loadCatalog().then(setCatalog); }, [given]);

  const suggested = useMemo(() => suggestPictures(text, catalog, 6), [text, catalog]);
  const found = useMemo(() => searchPictures(query, catalog, 30), [query, catalog]);
  const chosen = catalog.find((p) => p.n === value);

  return (
    <fieldset className={s.picBox}>
      <legend>Picture <span className={s.optional}>(optional)</span></legend>
      {value ? (
        <div className={s.picChosen}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pictureSrc(value)} alt="" width={64} height={64} />
          <span>{chosen?.l ?? value.replace(/-/g, ' ')}</span>
          <button type="button" className={s.linkBtn} onClick={() => onChange('')}>Remove picture</button>
        </div>
      ) : (
        <p className={s.hint}>Show a picture of the key word above the question. It should never give the answer away.</p>
      )}
      {suggested.length > 0 ? (
        <div className={s.picRow}>
          <span className={s.picLabel}>Suggested</span>
          <div className={s.picGrid}>{suggested.map((p) => <Thumb key={p.n} p={p} onPick={onChange} />)}</div>
        </div>
      ) : null}
      <label className={s.picSearch}>
        <span className={s.picLabel}>Search pictures</span>
        <input className={s.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="bus, cake, rain…" autoComplete="off" />
      </label>
      {query.trim() ? (
        found.length ? <div className={s.picGrid}>{found.map((p) => <Thumb key={p.n} p={p} onPick={(n) => { onChange(n); setQuery(''); }} />)}</div>
          : <p className={s.hint}>No pictures for &ldquo;{query.trim()}&rdquo;. Try another word.</p>
      ) : null}
    </fieldset>
  );
}
