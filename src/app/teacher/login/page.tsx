import type { Metadata } from 'next';
import { requestLink } from '../actions';
import styles from '../teacher.module.css';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <h1 className={styles.h1}>Blobby teacher</h1>
        <p className={styles.sub}>Sign in with your email. We will send you a link.</p>
        <form action={requestLink}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
          <button type="submit" className={styles.solid}>Email me a link</button>
        </form>
        {sent ? <p className={styles.note} role="status">If that email can sign in, a link is on its way. Check your email.</p> : null}
        {error ? <p className={styles.note} role="alert">That link did not work. Ask for a new one.</p> : null}
      </div>
    </div>
  );
}
