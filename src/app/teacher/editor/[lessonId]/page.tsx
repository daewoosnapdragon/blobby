import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTeacher } from '@/lib/supabase/server';
import { getEditorLesson } from '@/lib/db/teacher';
import { signOut } from '../../actions';
import { TeacherShell } from '../../views';
import { EditorView, type EditorBanner } from '../EditorView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit questions' };

export default async function EditorPage({ params, searchParams }: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ edit?: string; add?: string; saved?: string; deleted?: string }>;
}) {
  await requireTeacher();
  const { lessonId } = await params;
  const { edit, add, saved, deleted } = await searchParams;
  const data = await getEditorLesson(lessonId);
  if (!data) notFound();
  const banner: EditorBanner = saved === '1' ? 'saved' : saved === 'noaudio' ? 'noaudio' : deleted === '1' ? 'deleted' : null;
  return (
    <TeacherShell signOut={signOut} current="plans">
      <EditorView data={data} edit={edit} add={add} banner={banner} />
    </TeacherShell>
  );
}
