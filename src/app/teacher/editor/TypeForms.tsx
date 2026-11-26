'use client';
import { useId } from 'react';
import type { NonWatchDraft } from '@/lib/questions/draft';
import { Field, ListField, TextField } from './fields';
import s from './editor.module.css';

type D<T extends NonWatchDraft['type']> = Extract<NonWatchDraft, { type: T }>;
type P<T extends NonWatchDraft['type']> = { draft: D<T>; onChange: (d: D<T>) => void };

function PickOneForm({ draft: d, onChange }: P<'pick_one'>) {
  return (
    <>
      <TextField label="Question" value={d.prompt} onChange={(prompt) => onChange({ ...d, prompt })} placeholder="Which sentence is about yesterday?" />
      <ListField legend="Choices" hint="Select the right one. Two to four choices." itemLabel="Choice" addLabel="Add a choice" min={2} max={4}
        items={d.choices} answer={d.answer} onChange={(choices, answer) => onChange({ ...d, choices, answer: answer ?? d.answer })} />
    </>
  );
}

function FillBlankForm({ draft: d, onChange }: P<'fill_blank'>) {
  return (
    <>
      <div className={s.pair}>
        <TextField label="Before the blank" value={d.before} onChange={(before) => onChange({ ...d, before })} placeholder="Yesterday, we" />
        <TextField label="After the blank" value={d.after} onChange={(after) => onChange({ ...d, after })} placeholder="pizza." />
      </div>
      <ListField legend="Choices" hint="Select the word that fits." itemLabel="Choice" addLabel="Add a choice" min={2}
        items={d.choices} answer={d.answer} onChange={(choices, answer) => onChange({ ...d, choices, answer: answer ?? d.answer })} />
    </>
  );
}

function FindFixForm({ draft: d, onChange }: P<'find_fix'>) {
  const group = useId();
  const words = d.sentence.trim().split(/\s+/).filter(Boolean);
  return (
    <>
      <TextField label="Sentence" hint="Type the whole sentence, mistake included." value={d.sentence}
        onChange={(sentence) => onChange({ ...d, sentence, wrongIndex: d.wrongIndex < sentence.trim().split(/\s+/).filter(Boolean).length ? d.wrongIndex : -1 })} placeholder="She goed home." />
      <fieldset className={s.list}>
        <legend>Which word is wrong?</legend>
        {words.length === 0 ? <p className={s.hint}>Type the sentence above, then pick the wrong word.</p> : (
          <div className={s.chips}>
            {words.map((w, i) => (
              <label key={i} className={s.chip}>
                <input type="radio" name={group} checked={d.wrongIndex === i} onChange={() => onChange({ ...d, wrongIndex: i })} />
                <span>{w}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <ListField legend="Fixes" hint="What the kid can pick to fix it. Select the right fix." itemLabel="Fix" addLabel="Add a fix" min={2}
        items={d.fixes} answer={d.answer} onChange={(fixes, answer) => onChange({ ...d, fixes, answer: answer ?? d.answer })} />
    </>
  );
}

function BuildItForm({ draft: d, onChange }: P<'build_it'>) {
  return (
    <>
      <TextField label="Instruction" value={d.prompt} onChange={(prompt) => onChange({ ...d, prompt })} placeholder="Build the sentence." />
      <ListField legend="Tiles, in the right order" hint="One word or phrase per tile. Kids see them shuffled." itemLabel="Tile" addLabel="Add a tile" min={2} max={14}
        items={d.tiles} onChange={(tiles) => onChange({ ...d, tiles })} />
      <ListField legend="Extra tiles (optional)" hint="Wrong tiles that don't belong in the sentence." itemLabel="Extra tile" addLabel="Add an extra tile" min={0} max={6}
        items={d.distractors} onChange={(distractors) => onChange({ ...d, distractors })} />
    </>
  );
}

function SortItForm({ draft: d, onChange }: P<'sort_it'>) {
  return (
    <>
      <TextField label="Instruction" value={d.prompt} onChange={(prompt) => onChange({ ...d, prompt })} placeholder="Sort the words." />
      <ListField legend="Groups" hint="Two to four boxes the words go into." itemLabel="Group" addLabel="Add a group" min={2} max={4}
        items={d.groups}
        onChange={(groups, _a, removed) => onChange({
          ...d, groups,
          items: removed === undefined ? d.items : d.items.map((it) => ({ ...it, group: it.group === removed ? 0 : it.group > removed ? it.group - 1 : it.group })),
        })} />
      <fieldset className={s.list}>
        <legend>Words</legend>
        <p className={s.hint}>Choose which group each word belongs in.</p>
        {d.items.map((it, i) => (
          <div key={i} className={s.row}>
            <span className={s.rowNum} aria-hidden="true">{i + 1}</span>
            <input className={s.input} value={it.text} aria-label={`Word ${i + 1}`} autoComplete="off"
              onChange={(e) => onChange({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            <select className={s.select} value={it.group} aria-label={`Group for word ${i + 1}`}
              onChange={(e) => onChange({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, group: Number(e.target.value) } : x)) })}>
              {d.groups.map((g, gi) => <option key={gi} value={gi}>{g.trim() || `Group ${gi + 1}`}</option>)}
            </select>
            <button type="button" className={s.iconBtn} disabled={d.items.length <= 1} aria-label={`Remove word ${i + 1}`}
              onClick={() => onChange({ ...d, items: d.items.filter((_, j) => j !== i) })}><span aria-hidden="true">×</span></button>
          </div>
        ))}
        <button type="button" className={s.addBtn} disabled={d.items.length >= 16} onClick={() => onChange({ ...d, items: [...d.items, { text: '', group: 0 }] })}>+ Add a word</button>
      </fieldset>
    </>
  );
}

function ListenTapForm({ draft: d, onChange }: P<'listen_tap'>) {
  return (
    <>
      <TextField label="Instruction" value={d.prompt} onChange={(prompt) => onChange({ ...d, prompt })} />
      <TextField label="Word or sentence to say aloud" hint="Kids hear this, then tap the matching choice." value={d.audioText} onChange={(audioText) => onChange({ ...d, audioText })} placeholder="bee" />
      <ListField legend="Choices" hint="Written words. Select the one that matches." itemLabel="Choice" addLabel="Add a choice" min={2} max={6}
        items={d.choices} answer={d.answer} onChange={(choices, answer) => onChange({ ...d, choices, answer: answer ?? d.answer })} />
    </>
  );
}

function RightWrongForm({ draft: d, onChange }: P<'right_wrong'>) {
  const group = useId();
  return (
    <>
      <TextField label="Question" value={d.prompt} onChange={(prompt) => onChange({ ...d, prompt })} />
      <TextField label="Sentence" value={d.sentence} onChange={(sentence) => onChange({ ...d, sentence })} placeholder="She don’t like carrots." />
      <fieldset className={s.list}>
        <legend>Is it right?</legend>
        <div className={s.chips}>
          {([true, false] as const).map((yes) => (
            <label key={String(yes)} className={s.chip}>
              <input type="radio" name={group} checked={d.right === yes} onChange={() => onChange({ ...d, right: yes })} />
              <span>{yes ? 'Yes' : 'No'}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function OddOneOutForm({ draft: d, onChange }: P<'odd_one_out'>) {
  return (
    <>
      <TextField label="Instruction" value={d.prompt} onChange={(prompt) => onChange({ ...d, prompt })} placeholder="Which word doesn’t belong?" />
      <ListField legend="Words" hint="Three or four words. Select the odd one." itemLabel="Word" addLabel="Add a word" min={3} max={4}
        items={d.words} answer={d.answer} onChange={(words, answer) => onChange({ ...d, words, answer: answer ?? d.answer })} />
    </>
  );
}

function PictureFirstForm({ draft: d, onChange }: P<'picture_first'>) {
  return (
    <>
      <TextField label="Question" value={d.prompt} onChange={(prompt) => onChange({ ...d, prompt })} placeholder="Which one matches the picture?" />
      <ListField legend="Choices" hint="Two to four. Select the one that matches the picture." itemLabel="Choice" addLabel="Add a choice" min={2} max={4}
        items={d.choices} answer={d.answer} onChange={(choices, answer) => onChange({ ...d, choices, answer: answer ?? d.answer })} />
    </>
  );
}

export function TypeForm({ draft, onChange }: { draft: NonWatchDraft; onChange: (d: NonWatchDraft) => void }) {
  switch (draft.type) {
    case 'pick_one': return <PickOneForm draft={draft} onChange={onChange} />;
    case 'fill_blank': return <FillBlankForm draft={draft} onChange={onChange} />;
    case 'find_fix': return <FindFixForm draft={draft} onChange={onChange} />;
    case 'build_it': return <BuildItForm draft={draft} onChange={onChange} />;
    case 'sort_it': return <SortItForm draft={draft} onChange={onChange} />;
    case 'listen_tap': return <ListenTapForm draft={draft} onChange={onChange} />;
    case 'right_wrong': return <RightWrongForm draft={draft} onChange={onChange} />;
    case 'odd_one_out': return <OddOneOutForm draft={draft} onChange={onChange} />;
    case 'picture_first': return <PictureFirstForm draft={draft} onChange={onChange} />;
  }
}

export { Field };
