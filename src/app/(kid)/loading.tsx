import { ProblemScreen } from '@/components/ui/ProblemScreen';
import { koKid } from '@/lib/copy.ko';

/** Shown while a kid page loads: the blob bounces (it stops under reduced motion). Never blank. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <ProblemScreen title="Just a sec…" parentNote={koKid.loading} mood="happy" bounce />
    </div>
  );
}
