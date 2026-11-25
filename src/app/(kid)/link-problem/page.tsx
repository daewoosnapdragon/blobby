import Link from 'next/link';
import { ProblemScreen, PillArrow } from '@/components/ui/ProblemScreen';
import { koJoin } from '@/lib/copy.ko';
import styles from './page.module.css';

const copy = {
  title: "This link didn't work",
  message: 'No worries. You can still get in with your class code.',
  action: 'Use my class code',
};

export default function LinkProblem() {
  return (
    <ProblemScreen
      title={copy.title}
      message={copy.message}
      parentNote={`${koJoin.problemTitle}. ${koJoin.problemHelp}`}
      action={
        <Link href="/join" className={styles.pill}>
          {copy.action}
          <PillArrow />
        </Link>
      }
    />
  );
}
