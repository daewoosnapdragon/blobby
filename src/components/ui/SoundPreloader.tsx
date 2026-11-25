'use client';
import { useEffect } from 'react';
import { preloadOnFirstGesture } from '@/lib/sound';

/** Renders nothing; warms up the effect sounds after the kid's first tap. */
export function SoundPreloader() {
  useEffect(() => preloadOnFirstGesture(), []);
  return null;
}
