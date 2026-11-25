'use client';
import { useEffect } from 'react';
import { reloadPage } from '@/lib/reloadPage';
import { koKid } from '@/lib/copy.ko';

/**
 * Last resort: replaces the root layout, so it brings its own html, body, and plain inline styles.
 * It covers kid routes too, so the words are for a kid or parent; settings hints live on the teacher error page.
 * Try again reloads the whole page: reset() alone would re-render the same failed server result.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#F7F3EF', color: '#1F1F1F', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, margin: '0 0 12px' }}>Oops, that didn’t work</h1>
          <p style={{ fontSize: 18, color: '#6B655F', margin: '0 0 12px' }}>It’s not your fault. Let’s try once more.</p>
          <p lang="ko" style={{ fontSize: 15, color: '#6B655F', margin: '0 0 24px' }}>{koKid.error}</p>
          <button
            type="button"
            onClick={() => reloadPage.run()}
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
