import type { Metadata } from 'next';
import { requestLink, signInWithPassword } from '../actions';
import styles from '../teacher.module.css';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <h1 className={styles.h1}>Blobby teacher</h1>
        <p className={styles.sub}>Sign in with your email and password.</p>
        <form action={signInWithPassword}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
          <label htmlFor="password">Password</label>
          {/* Not `required`: the link button below needs the email checked but the password left empty. The server rejects an empty password. */}
          <input id="password" name="password" type="password" autoComplete="current-password" />
          <button type="submit" className={styles.solid}>Sign in</button>
          <button type="submit" formAction={requestLink} className={styles.ghost}>Email me a link instead</button>
          <p className={styles.hint}>First time, or forgot your password? Use an email link, then set a password on your Account page.</p>
        </form>
        {sent ? <p className={styles.note} role="status">If that email can sign in, a link is on its way. Check your email.</p> : null}
        {error === 'signin' ? <p className={styles.note} role="alert">That email and password didn&apos;t work.</p> : null}
        {error && error !== 'signin' ? <p className={styles.note} role="alert">That link did not work. Ask for a new one.</p> : null}
      </div>
    </div>
  );
}
