'use client';
import { useEffect } from 'react';

const EVERY_MS = 30_000;
const ACTIVE_MS = 60_000;

let lastTouch = -Infinity;
/** Counts as "the kid is here" right now: called by the video step while a video is playing. */
export function markActive(): void {
  lastTouch = Date.now();
}

/**
 * Counts practice time: every 30s, tells the server the kid is here, but only when the tab is visible
 * AND they tapped or typed in the last 60s. Silent on failure; stops when the screen goes away.
 */
export function usePracticePing(): void {
  useEffect(() => {
    lastTouch = -Infinity;
    const touch = markActive;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastTouch > ACTIVE_MS) return;
      try {
        fetch('/api/ping', { method: 'POST', keepalive: true }).catch(() => {});
      } catch {
        // never reaches the UI
      }
    }, EVERY_MS);
    window.addEventListener('pointerdown', touch, true);
    window.addEventListener('keydown', touch, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', touch, true);
      window.removeEventListener('keydown', touch, true);
    };
  }, []);
}
