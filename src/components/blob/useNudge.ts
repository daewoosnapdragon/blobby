'use client';
import { useEffect, useState } from 'react';
import { blobScene } from '@/lib/scene';
import { sceneParam } from '@/lib/sceneOverride';

export type Nudge = 'morning' | 'bedtime' | null;

/** True when the device asks for less motion (false where matchMedia is missing). */
export function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * The morning/bedtime nudge from the device's local hour. It is null on the server and on first render, then set
 * after mount, so server and client markup match and nothing shifts (callers reserve the space).
 */
export function useNudge(): Nudge {
  const [nudge, setNudge] = useState<Nudge>(null);
  useEffect(() => {
    const fake = sceneParam('scene-hour', new URLSearchParams(window.location.search));
    const hour = fake !== null && fake !== '' && !isNaN(+fake) ? +fake : new Date().getHours();
    setNudge(blobScene(new Date(), hour).nudge);
  }, []);
  return nudge;
}
