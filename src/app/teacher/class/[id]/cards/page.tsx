import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeacherUser } from '@/lib/supabase/server';
import { cardsForClass } from '@/lib/db/teacher';
import { appOrigin, MissingAppUrlError } from '@/lib/teacherUrl';
import { qrSvg } from '@/lib/qr';
import { signOut } from '../../../actions';
import { TeacherShell } from '../../../views';
import { BackIcon } from '@/components/ui/icons';
import teacher from '../../../teacher.module.css';
import { CardsSheet, type CardData } from './CardsSheet';
import { PrintButton } from './PrintButton';
import styles from './cards.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cards' };

export default async function CardsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ student?: string }> }) {
  const me = await requireTeacherUser();
  const { id } = await params;
  const { student } = await searchParams;
  const data = await cardsForClass(id, student);
  if (!data) notFound();

  let origin: string | null = null;
  try { origin = await appOrigin(); } catch (e) { if (!(e instanceof MissingAppUrlError)) throw e; }

  const back = (
    <Link href={`/teacher/class/${id}`} className={`${teacher.back} ${teacher.noPrint}`}><BackIcon size={18} /> {data.className}</Link>
  );
  if (!origin) {
    return (
      <TeacherShell signOut={signOut} who={me.name ?? me.email}>
        {back}
        <p role="alert" className={styles.error}>Cards can&apos;t be made yet: APP_URL is not set on the server. Set it to the app&apos;s public address, then reload this page.</p>
      </TeacherShell>
    );
  }
  if (data.students.length === 0) {
    return <TeacherShell signOut={signOut} who={me.name ?? me.email}>{back}<p className={teacher.empty}>No cards to print here.</p></TeacherShell>;
  }

  const cards: CardData[] = await Promise.all(data.students.map(async (s) => {
    const url = `${origin}/s/${s.secret}`;
    return { id: s.id, name: s.displayName, blobColor: s.blobColor, url, svg: await qrSvg(url) };
  }));

  return (
    <TeacherShell signOut={signOut} who={me.name ?? me.email}>
      {back}
      <div className={styles.toolbar}>
        <h1 className={teacher.h1}>{student ? `Card for ${cards[0].name}` : `${data.className} cards`}</h1>
        <PrintButton />
      </div>
      <p className={styles.note}>{cards.length} {cards.length === 1 ? 'card' : 'cards'}, 8 to a page. Print on A4 at 100% (no scaling), then cut along the dashed lines. Keep these private: each QR code signs a kid in.</p>
      <CardsSheet cards={cards} classCode={data.classCode} siteAddress={origin.replace(/^https?:\/\//, '')} />
    </TeacherShell>
  );
}
