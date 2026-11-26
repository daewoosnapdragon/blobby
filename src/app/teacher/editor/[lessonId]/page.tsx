import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTeacherUser } from '@/lib/supabase/server';
import { getEditorLesson } from '@/lib/db/teacher';
import { signOut } from '../../actions';
import { TeacherShell } from '../../views';
import { EditorView, type EditorBanner } from '../EditorView';

export const dynamic = 'force-dynamic';
// Saving makes audio (up to 20 s) before it answers.
export const maxDuration = 60;
export const metadata: Metadata = { title: 'Edit questions' };

export default async function EditorPage({ params, searchParams }: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ edit?: string; add?: string; saved?: string; deleted?: string; problem?: string }>;
}) {
  const me = await requireTeacherUser();
  const { lessonId } = await params;
  const { edit, add, saved, deleted, problem } = await searchParams;
  const data = await getEditorLesson(lessonId);
  if (!data) notFound();
  const banner: EditorBanner = saved === '1' ? 'saved' : saved === 'noaudio' ? 'noaudio' : deleted === '1' ? 'deleted' : problem === 'last' ? 'last' : null;
  return (
    <TeacherShell signOut={signOut} who={me.name ?? me.email} current="plans">
      <EditorView data={data} edit={edit} add={add} banner={banner} />
    </TeacherShell>
  );
}
