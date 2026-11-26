import { NAME_MAX, PASSWORD_MIN } from '@/lib/teacherAccount';
import styles from '../teacher.module.css';

const SAVED: Record<string, string> = {
  name: 'Name saved.',
  password: 'Password saved. Use it next time you sign in.',
};

const ERRORS: Record<string, string> = {
  name: `Enter a name from 1 to ${NAME_MAX} characters.`,
  short: `Use at least ${PASSWORD_MIN} characters.`,
  mismatch: "The two passwords don't match.",
  reauth: 'For safety, sign in again with an email link, then set your password.',
  weak: 'That password is too easy to guess. Try a longer one.',
  same: "That's already your password.",
  failed: "That didn't save. Try again.",
};

type Props = {
  email: string;
  name: string | null;
  saved?: string;
  error?: string;
  saveName: (formData: FormData) => Promise<void>;
  savePassword: (formData: FormData) => Promise<void>;
};

/** Presentational: the page owns auth and passes the server actions in. Unknown saved/error values show nothing. */
export function AccountView({ email, name, saved, error, saveName, savePassword }: Props) {
  const savedText = saved ? SAVED[saved] : undefined;
  const errorText = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined;
  return (
    <>
      <h1 className={styles.h1}>Your account</h1>
      <p className={styles.sub}>Signed in as {email}. To change it, ask whoever runs the app&apos;s settings.</p>
      {savedText ? <p className={styles.note} role="status">{savedText}</p> : null}
      {errorText ? <p className={styles.note} role="alert">{errorText}</p> : null}

      <section className={styles.accountCard} aria-labelledby="name-heading">
        <h2 id="name-heading" className={styles.h2}>Your name</h2>
        <p className={styles.hint}>Shown at the top of the teacher pages.</p>
        <form action={saveName} className={styles.accountForm}>
          <label htmlFor="teacher-name">Name</label>
          <input id="teacher-name" name="name" defaultValue={name ?? ''} maxLength={NAME_MAX} required autoComplete="name" />
          <button type="submit" className={styles.solid}>Save name</button>
        </form>
      </section>

      <section className={styles.accountCard} aria-labelledby="password-heading">
        <h2 id="password-heading" className={styles.h2}>Password</h2>
        <p className={styles.hint}>At least {PASSWORD_MIN} characters. Use it with your email to sign in.</p>
        <form action={savePassword} className={styles.accountForm}>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="password" type="password" minLength={PASSWORD_MIN} required autoComplete="new-password" />
          <label htmlFor="confirm-password">Type it again</label>
          <input id="confirm-password" name="confirm" type="password" minLength={PASSWORD_MIN} required autoComplete="new-password" />
          <button type="submit" className={styles.solid}>Save password</button>
        </form>
      </section>
    </>
  );
}
