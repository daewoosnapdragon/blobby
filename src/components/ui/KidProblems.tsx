import { ProblemScreen } from './ProblemScreen';
import { PillButton } from './PillButton';
import { koKid } from '@/lib/copy.ko';

/** A kid API said 401: nobody is signed in on this phone any more (spec 5.9: never a blank screen). */
export function WhoAreYouScreen() {
  return (
    <ProblemScreen
      title="Who’s practicing?"
      message="Find your name to keep going."
      parentNote={koKid.whoAreYou}
      mood="idle"
      action={<PillButton href="/join">Find my name</PillButton>}
    />
  );
}

/** A lesson or week the kid can't open (locked, not theirs, or a bad link). */
export function NotOpenScreen() {
  return (
    <ProblemScreen
      title="This isn’t open yet"
      message="Let’s go back to your plan."
      parentNote={koKid.notOpen}
      action={<PillButton href="/">Back to my plan</PillButton>}
    />
  );
}
