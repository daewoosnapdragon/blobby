'use client';
import { useEffect } from 'react';
import { ProblemScreen } from '@/components/ui/ProblemScreen';
import { PillButton } from '@/components/ui/PillButton';
import { koKid } from '@/lib/copy.ko';

/** Something broke while loading a kid page: a calm message and a way to try again (spec 5.9). */
export default function KidError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ProblemScreen
      title="Oops, that didn’t work"
      message="It’s not your fault. Let’s try once more."
      parentNote={koKid.error}
      action={<PillButton onClick={reset}>Try again</PillButton>}
    />
  );
}
