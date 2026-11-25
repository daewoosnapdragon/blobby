'use client';
import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProblemScreen } from '@/components/ui/ProblemScreen';
import { PillButton } from '@/components/ui/PillButton';
import { koKid } from '@/lib/copy.ko';

/** Something broke while loading a kid page: a calm message and a way to try again (spec 5.9). */
export default function KidError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  // reset() alone re-renders the cached failed server result; refresh() refetches it first.
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return (
    <ProblemScreen
      title="Oops, that didn’t work"
      message="It’s not your fault. Let’s try once more."
      parentNote={koKid.error}
      action={
        <>
          <PillButton onClick={retry}>Try again</PillButton>
          {error.digest ? <small style={{ display: 'block', marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>Code: {error.digest}</small> : null}
        </>
      }
    />
  );
}
