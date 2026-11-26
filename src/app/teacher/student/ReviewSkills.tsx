import type { StudentSkillRow } from '@/lib/db/teacher';
import { SKILLS, SKILL_KEYS, isSkillKey } from '@/lib/skills';
import styles from '../teacher.module.css';

const SOURCE: Record<StudentSkillRow['source'], string> = {
  pretest: 'From the pretest', next_step: 'Next step', auto: 'Added by practice', teacher: 'Added by you',
};
const label = (k: string) => (isSkillKey(k) ? SKILLS[k].label : k);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

function RemoveButton({ studentId, skill, action }: { studentId: string; skill: string; action: (f: FormData) => Promise<void> }) {
  return (
    <form action={action} className={styles.inlineForm}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="skill" value={skill} />
      <button type="submit" className={styles.textBtn} aria-label={`Remove ${label(skill)}`}>Remove</button>
    </form>
  );
}

/**
 * The kid's review track, as Kyla sees and changes it: skills being worked on (3 "just for you" questions a lesson
 * come from these), mastered ones (spaced out), and ones she removed (never added back on their own).
 */
export function ReviewSkills({ studentId, skills, addAction, removeAction }: {
  studentId: string; skills: StudentSkillRow[];
  addAction: (f: FormData) => Promise<void>; removeAction: (f: FormData) => Promise<void>;
}) {
  const working = skills.filter((s) => s.state === 'active');
  const mastered = skills.filter((s) => s.state === 'mastered');
  const removed = skills.filter((s) => s.state === 'removed');
  const onTrack = new Set([...working, ...mastered].map((s) => s.skill));
  const addable = SKILL_KEYS.filter((k) => !onTrack.has(k));

  return (
    <section className={styles.card} aria-labelledby="review-skills">
      <h2 id="review-skills" className={styles.h2}>Review skills</h2>
      <p className={styles.hint}>Each lesson mixes in 3 &ldquo;just for you&rdquo; questions from these skills.</p>
      {working.length === 0 && mastered.length === 0 ? (
        <p className={styles.empty}>No review skills yet. Add one below, or practice will add skills this kid keeps missing.</p>
      ) : null}
      {working.length > 0 ? (
        <>
          <h3 className={styles.h3}>Working on</h3>
          <ul className={styles.trackList} aria-label="Working on">
            {working.map((s) => (
              <li key={s.skill}>
                <span className={styles.skillName}>{label(s.skill)}</span>
                <span className={styles.sourceTag}>{SOURCE[s.source]}</span>
                <RemoveButton studentId={studentId} skill={s.skill} action={removeAction} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {mastered.length > 0 ? (
        <>
          <h3 className={styles.h3}>Mastered</h3>
          <ul className={styles.trackList} aria-label="Mastered">
            {mastered.map((s) => (
              <li key={s.skill}>
                <span className={styles.skillName}>{label(s.skill)}</span>
                <span className={styles.sourceTag}>Comes back every {ordinal(s.spacing)} lesson</span>
                <RemoveButton studentId={studentId} skill={s.skill} action={removeAction} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {removed.length > 0 ? (
        <>
          <h3 className={styles.h3}>Removed</h3>
          <ul className={styles.trackList} aria-label="Removed">
            {removed.map((s) => (
              <li key={s.skill}><span className={styles.skillMuted}>{label(s.skill)}</span><span className={styles.sourceTag}>Removed by you</span></li>
            ))}
          </ul>
        </>
      ) : null}
      <form action={addAction} className={styles.addSkill}>
        <input type="hidden" name="studentId" value={studentId} />
        <label htmlFor="add-skill">Add a skill</label>
        <div className={styles.renameRow}>
          <select id="add-skill" name="skill" required defaultValue="">
            <option value="" disabled>Choose a skill</option>
            {addable.map((k) => <option key={k} value={k}>{SKILLS[k].label}</option>)}
          </select>
          <button type="submit" className={styles.solid}>Add</button>
        </div>
      </form>
    </section>
  );
}
