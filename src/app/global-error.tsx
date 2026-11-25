'use client';
import { useEffect } from 'react';

/** Last resort: replaces the root layout, so it brings its own html, body, and plain inline styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#F7F3EF', color: '#1F1F1F', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, margin: '0 0 12px' }}>Something went wrong</h1>
          <p style={{ fontSize: 18, color: '#6B655F', margin: '0 0 24px' }}>Please try again. If this keeps happening, check the app’s settings in Vercel.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 48, padding: '0 28px', border: 'none', borderRadius: 999, background: '#1F1F1F', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
          {error.digest ? <p style={{ fontSize: 12, color: '#6B655F', marginTop: 24 }}>Support code: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
