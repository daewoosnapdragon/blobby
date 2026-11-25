'use client';
import { useId } from 'react';
import { setMuted, useMuted } from '@/lib/sound';
import { koKid } from '@/lib/copy.ko';
import { SoundIcon } from './icons';
import styles from './ui.module.css';

/** Mutes the effect sounds (pop, ding, boop, squeak). Read-aloud is learning, so it stays on. */
export function MuteToggle() {
  const muted = useMuted();
  const noteId = useId();
  return (
    <>
      <button
        type="button"
        className={styles.mute}
        aria-pressed={muted}
        aria-label={muted ? 'Turn sounds on' : 'Mute sounds'}
        aria-describedby={noteId}
        title="Sounds only. Read-aloud stays on."
        onClick={() => setMuted(!muted)}
      >
        <SoundIcon muted={muted} />
      </button>
      <span id={noteId} className="sr-only">Sound effects only. Hear it read-aloud stays on. <span lang="ko">{koKid.muteNote}</span></span>
    </>
  );
}
