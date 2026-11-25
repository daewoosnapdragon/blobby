'use client';
import { useActionState, useState } from 'react';
import { setWeekAction } from '../editorActions';
import { weekdayName } from '@/lib/dates';
import t from '../teacher.module.css';
import s from './plans.module.css';

export function WeekForm({ weekId, number, skill, opensOn }: { weekId: string; number: number; skill: string; opensOn: string }) {
  const [state, action, pending] = useActionState(setWeekAction, null);
  const [date, setDate] = useState(opensOn);
  const day = weekdayName(date);
  return (
    <form action={action} className={s.weekForm}>
      <input type="hidden" name="weekId" value={weekId} />
      <h4 className={s.weekNum}>Week {number}</h4>
      <div className={s.field}>
        <label htmlFor={`skill-${weekId}`}>Skill</label>
        <input id={`skill-${weekId}`} name="skill" defaultValue={skill} maxLength={60} required />
      </div>
      <div className={s.field}>
        <label htmlFor={`date-${weekId}`}>Opens on</label>
        <div className={s.dateRow}>
          <input id={`date-${weekId}`} name="opensOn" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <span className={s.weekday} aria-live="polite">{day || (date ? '' : 'No date yet')}</span>
        </div>
      </div>
      <button type="submit" className={t.solid} disabled={pending}>{pending ? 'Saving…' : 'Save week'}</button>
      <div role="status" className={s.status}>
        {state?.ok ? <span className={s.saved}>{state.message}</span> : null}
        {state && !state.ok ? <ul className={s.problems}>{state.problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
      </div>
    </form>
  );
}
