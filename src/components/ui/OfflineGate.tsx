'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { ProblemScreen } from './ProblemScreen';
import { koKid } from '@/lib/copy.ko';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}

/**
 * No internet: the blob holds an umbrella on top of the page. The page is never unmounted, so a lesson in
 * progress keeps its answers and place; it just can't be reached (inert) until the connection is back.
 */
export function OfflineGate({ children }: { children: ReactNode }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return (
    <>
      <div inert={!online} aria-hidden={!online || undefined}>{children}</div>
      {online ? null : (
        <div role="alert">
          <ProblemScreen
            variant="overlay"
            title="No internet right now"
            message="Your blob has an umbrella and is waiting. We’ll keep going when you’re back online."
            parentNote={koKid.offline}
            mood="sleepy"
            accessory="umbrella"
          />
        </div>
      )}
    </>
  );
}
