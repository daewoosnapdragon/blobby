'use client';
import { useId } from 'react';
import s from './editor.module.css';

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint ? <p className={s.hint}>{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} className={s.input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />}
    </Field>
  );
}

/**
 * Rows of text with Add / Remove. With `answer` set, each row also has a radio to mark the right one.
 * Removing a row keeps the right answer on the same row (or clears it if that row was removed).
 */
export function ListField({
  legend, hint, itemLabel, addLabel, items, answer, onChange, min = 2, max = 12,
}: {
  legend: string; hint?: string;
  /** "Choice" -> aria labels "Choice 2" */
  itemLabel: string; addLabel: string;
  items: string[];
  answer?: number;
  onChange: (items: string[], answer: number | undefined, removed?: number) => void;
  min?: number; max?: number;
}) {
  const group = useId();
  const withRadio = answer !== undefined;
  return (
    <fieldset className={s.list}>
      <legend>{legend}</legend>
      {hint ? <p className={s.hint}>{hint}</p> : null}
      {items.map((text, i) => (
        <div key={i} className={s.row}>
          {withRadio ? (
            <input type="radio" name={group} className={s.radio} checked={answer === i} onChange={() => onChange(items, i)} aria-label={`${itemLabel} ${i + 1} is the right answer`} />
          ) : <span className={s.rowNum} aria-hidden="true">{i + 1}</span>}
          <input className={s.input} value={text} aria-label={`${itemLabel} ${i + 1}`} autoComplete="off"
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)), answer)} />
          <button type="button" className={s.iconBtn} disabled={items.length <= min} aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i), answer === undefined ? undefined : answer === i ? -1 : answer > i ? answer - 1 : answer, i)}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
      <button type="button" className={s.addBtn} disabled={items.length >= max} onClick={() => onChange([...items, ''], answer)}>+ {addLabel}</button>
    </fieldset>
  );
}
