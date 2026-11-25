import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getHome, practiceAvailable, studentFromRequest, type HomeData } from '@/lib/db/kid';
import { seoulDate } from '@/lib/dates';
import { blobScene } from '@/lib/scene';
import { sceneNow } from '@/lib/sceneOverride';
import { Snow } from '@/components/blob/Snow';
import { NudgeLine } from '@/components/blob/NudgeLine';
import { toBlobColor, type BlobColorKey } from '@/lib/blobColors';
import { opensLabel, weekTileColor } from '@/lib/weekLabels';
import { MiniBlob } from '@/components/blob/MiniBlob';
import { NotYou } from '@/components/auth/NotYou';
import { StarCount } from '@/components/ui/StarCount';
import { PillButton } from '@/components/ui/PillButton';
import { MuteToggle } from '@/components/ui/MuteToggle';
import { ArrowIcon, CheckIcon, ChestIcon, DiceIcon, LockIcon, Sparkle } from '@/components/ui/icons';
import { PokeBlob } from './home/PokeBlob';
import { Rail } from './home/Rail';
import styles from './home/home.module.css';

export const dynamic = 'force-dynamic';

type Week = HomeData['weeks'][number];

function remainingLine(w: Week): string {
  if (w.lessons.length === 0) return 'Lessons are on the way';
  const left = w.lessons.filter((l) => !l.done).length;
  if (left === 0) return 'Week done!';
  return `${left} more ${left === 1 ? 'lesson' : 'lessons'} to finish the week`;
}

function Dots({ w }: { w: Week }) {
  const done = w.lessons.filter((l) => l.done).length;
  return (
    <div className={styles.dots} role="img" aria-label={`${done} of ${w.lessons.length} lessons done`}>
      {w.lessons.map((l) => <span key={l.id} className={l.done ? styles.dotDone : styles.dot} />)}
    </div>
  );
}

function ThisWeek({ home, color, hat }: { home: HomeData; color: BlobColorKey; hat: 'santa' | 'seollal' | null }) {
  const current = home.weeks.find((w) => w.id === home.currentWeekId);
  let tag: string, title: string, line: string, action: React.ReactNode = null, dots: React.ReactNode = null;
  if (!home.plan) {
    tag = 'Practice';
    title = 'Your plan is on the way';
    line = 'Your teacher is getting your lessons ready.';
  } else if (!current) {
    const first = home.weeks[0];
    tag = first ? `Week ${first.number} · coming up` : 'Practice';
    title = first?.skill ?? 'Your plan is on the way';
    line = first ? `${opensLabel(first.opensOn, seoulDate(new Date()))}. See you then!` : 'Your teacher is getting your lessons ready.';
  } else {
    tag = `Week ${current.number} · this week`;
    title = current.skill;
    line = remainingLine(current);
    dots = <Dots w={current} />;
    const next = current.lessons.find((l) => !l.done);
    action = <PillButton size="md" href={next ? `/lesson/${next.id}` : `/week/${current.id}`}>Keep going</PillButton>;
  }
  return (
    <section className={styles.weekCard} aria-labelledby="this-week">
      <PokeBlob color={color} hat={hat} />
      <Sparkle size={26} className={styles.cardSparkle} />
      <div className={styles.weekCardBody}>
        <span className={styles.tagYellow}>{tag}</span>
        <h2 id="this-week" className={styles.skill}>{title}</h2>
        <p className={styles.line}>{line}</p>
        {dots}
        <div className={styles.grow} />
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </section>
  );
}

function WeekTile({ w, i, home, color, today, doneIndex }: { w: Week; i: number; home: HomeData; color: BlobColorKey; today: string; doneIndex: number }) {
  const final = i === home.weeks.length - 1 && home.weeks.length > 1;
  const current = w.id === home.currentWeekId;
  let label: string, tile: React.ReactNode, tileBg: string, kind: 'done' | 'current' | 'open' | 'locked';
  if (!w.open) {
    kind = 'locked';
    tileBg = '#E6DFD7';
    label = `Week ${w.number}`;
    tile = (
      <>
        {final ? <ChestIcon width={40} height={34} /> : <LockIcon />}
        <span className={styles.opens}>{opensLabel(w.opensOn, today)}</span>
      </>
    );
  } else if (current) {
    kind = 'current';
    tileBg = '#FFE59A';
    label = `Week ${w.number} · you are here`;
    tile = (
      <span className={styles.here}>
        {final ? <ChestIcon width={40} height={34} /> : null}
        <span className={styles.hereBlob}><MiniBlob color={color} size={final ? 48 : 64} stroke blink="late" breathe eyes="small" /></span>
      </span>
    );
  } else if (w.done) {
    kind = 'done';
    tileBg = weekTileColor(doneIndex);
    label = `Week ${w.number} · done`;
    tile = final ? <ChestIcon width={52} height={44} /> : <CheckIcon />;
  } else {
    kind = 'open';
    tileBg = 'var(--bg)';
    const done = w.lessons.filter((l) => l.done).length;
    label = `Week ${w.number} · ${done} of ${w.lessons.length}`;
    tile = final ? <ChestIcon width={52} height={44} /> : <ArrowIcon size={26} />;
  }
  const inner = (
    <>
      <span className={`${styles.tile} ${kind === 'current' ? styles.tileHere : ''}`} style={{ background: tileBg }}>{tile}</span>
      <span className={kind === 'current' ? styles.weekLabelStrong : styles.weekLabel}>{label}</span>
      <span className={styles.weekName}>{w.skill}</span>
    </>
  );
  const cls = `${styles.weekTile} ${styles[kind]}`;
  return w.open ? (
    <Link href={`/week/${w.id}`} className={cls} data-current={current ? '' : undefined}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  if (!student.blob_color) redirect('/pick');
  const [home, canPractice] = await Promise.all([getHome(student.id), practiceAvailable(student.id)]);
  const color = toBlobColor(home.student.blobColor);
  const now = sceneNow(sp['scene-date']);
  const scene = blobScene(now, 12); // snow and hat come from the Seoul date; the time-of-day nudge is client-only
  const today = seoulDate(new Date());
  const doneCount = home.weeks.filter((w) => w.done).length;
  let doneSeen = 0;

  return (
    <main className={styles.screen}>
      {scene.snow ? <Snow /> : null}
      <header className={styles.top}>
        <Link href="/pick" className={styles.me} aria-label="Change my blob color" data-testid="me-blob">
          <MiniBlob color={color} size={34} blink="late" />
        </Link>
        <div className={styles.hello}>
          <h1 className={styles.hi}>Hi, {home.student.displayName}!</h1>
          <NotYou compact />
        </div>
        <MuteToggle />
        <StarCount value={home.totalStars} />
      </header>

      <NudgeLine />

      <div className={styles.layout}>
        <ThisWeek home={home} color={color} hat={scene.hat} />

        {home.plan ? (
          <div className={styles.side}>
            {home.weeks.length > 0 ? (
              <section className={styles.plan} aria-labelledby="plan-title">
                <div className={styles.planHead}>
                  <h2 id="plan-title" className={styles.planTitle}>{home.plan.title}</h2>
                  <span className={styles.planCount}>{doneCount} of {home.weeks.length} weeks</span>
                </div>
                <Rail>
                  {home.weeks.map((w, i) => (
                    <WeekTile key={w.id} w={w} i={i} home={home} color={color} today={today} doneIndex={w.done && w.id !== home.currentWeekId ? doneSeen++ : 0} />
                  ))}
                </Rail>
              </section>
            ) : null}

            {canPractice ? (
              <Link href="/practice" className={styles.free}>
                <span className={styles.freeIcon}><DiceIcon /></span>
                <span className={styles.freeText}>
                  <span className={styles.freeTitle}>Free practice</span>
                  <span className={styles.freeSub}>Mixed review for bonus stars</span>
                </span>
                <span className={styles.freeArrow}><ArrowIcon size={18} /></span>
              </Link>
            ) : (
              <div className={`${styles.free} ${styles.freeOff}`} data-testid="free-off">
                <span className={styles.freeIcon}><DiceIcon /></span>
                <span className={styles.freeText}>
                  <span className={styles.freeTitle}>Free practice</span>
                  <span className={styles.freeSub}>
                    {home.weeks.some((w) => w.open) ? 'Questions are on the way' : 'Opens when your first week does'}
                  </span>
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Link href="/stamps" className={styles.stamps}>
        <span className={styles.stampsIcon}><MiniBlob color={color} size={30} /></span>
        <span className={styles.stampsTitle}>My stamps</span>
        <span className={styles.stampsArrow}><ArrowIcon size={16} /></span>
      </Link>
    </main>
  );
}
