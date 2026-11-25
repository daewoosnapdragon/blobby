import { useSyncExternalStore } from 'react';

export type SoundName = 'pop' | 'ding' | 'boop' | 'squeak';

/** localStorage key for the mute choice. */
export const MUTE_KEY = 'wp_muted';

// Effect sounds only: read-aloud ("Hear it") is learning, so mute never touches it.
// Storage can throw (private windows, blocked site data); the choice is also kept in memory for the visit.
let memory: boolean | null = null;
const listeners = new Set<() => void>();

export function isMuted(): boolean {
  try {
    const v = window.localStorage.getItem(MUTE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    // fall through to the in-memory value
  }
  return memory ?? false;
}

export function setMuted(muted: boolean): void {
  memory = muted;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // not saved, but still muted for this visit
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === MUTE_KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

/** The mute state for the UI. Renders "not muted" on the server and first paint, then settles. */
export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted, () => false);
}

const cache = new Map<SoundName, HTMLAudioElement>();

function audioFor(name: SoundName): HTMLAudioElement | null {
  let a = cache.get(name);
  if (!a) {
    a = new Audio(`/sounds/${name}.mp3`);
    a.preload = 'auto'; // created on first use, so nothing downloads until a sound is wanted
    cache.set(name, a);
  }
  return a;
}

/** Plays an effect sound. Silent when muted, on the server, or when the browser says no. One element per sound: replaying restarts it. */
export function playSound(name: SoundName): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  if (isMuted()) return;
  try {
    const a = audioFor(name);
    if (!a) return;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // a sound is never worth breaking a lesson for
  }
}

/** Starts the download of a sound ahead of its first use (quietly ignores any failure). */
export function preloadSounds(names: SoundName[] = ['pop', 'ding', 'boop', 'squeak']): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try { names.forEach((n) => audioFor(n)); } catch { /* ignore */ }
}
