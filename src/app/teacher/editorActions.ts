'use server';
import { redirect, notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeacher } from '@/lib/supabase/server';
import { NotFoundError } from '@/lib/db/kid';
import { EditorError, saveQuestion, setWeek, softDeleteQuestion } from '@/lib/db/teacher';
import { draftToPayload, type Draft } from '@/lib/questions/draft';
import { isQuestionType } from '@/lib/questions/schema';
import { UUID_RE } from '@/lib/uuid';

/** What a form shows after submitting: problems to fix, or a saved note. */
export type FormState = { ok: boolean; problems: string[]; message?: string } | null;

const fail = (...problems: string[]): FormState => ({ ok: false, problems });

export async function saveQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const lessonId = String(formData.get('lessonId') ?? '');
  const questionId = String(formData.get('questionId') ?? '');
  const type = String(formData.get('type') ?? '');
  if (!UUID_RE.test(lessonId)) notFound();
  if (!isQuestionType(type)) return fail('Something went wrong with the form. Reload the page and try again.');
  let draft: Draft;
  try { draft = JSON.parse(String(formData.get('draft') ?? '')) as Draft; } catch { return fail('Something went wrong with the form. Reload the page and try again.'); }
  if (!draft || typeof draft !== 'object' || draft.type !== type) return fail('Something went wrong with the form. Reload the page and try again.');

  let audio: 'ok' | 'failed';
  try {
    ({ audio } = await saveQuestion(lessonId, questionId ? { id: questionId } : {}, type, draftToPayload(draft)));
  } catch (e) {
    if (e instanceof EditorError) return fail(...e.problems);
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  revalidatePath(`/teacher/editor/${lessonId}`);
  revalidatePath('/teacher/plans');
  redirect(`/teacher/editor/${lessonId}?saved=${audio === 'ok' ? '1' : 'noaudio'}`);
}

export async function deleteQuestionAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const lessonId = String(formData.get('lessonId') ?? '');
  const questionId = String(formData.get('questionId') ?? '');
  if (!UUID_RE.test(lessonId)) notFound();
  try { await softDeleteQuestion(questionId); } catch (e) {
    if (e instanceof EditorError) redirect(`/teacher/editor/${lessonId}?problem=last`);
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  revalidatePath(`/teacher/editor/${lessonId}`);
  revalidatePath('/teacher/plans');
  redirect(`/teacher/editor/${lessonId}?deleted=1`);
}

export async function setWeekAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  try {
    await setWeek(String(formData.get('weekId') ?? ''), { skill: String(formData.get('skill') ?? ''), opensOn: String(formData.get('opensOn') ?? '') });
  } catch (e) {
    if (e instanceof EditorError) return fail(...e.problems);
    if (e instanceof NotFoundError) return fail('That week no longer exists. Reload the page.');
    throw e;
  }
  revalidatePath('/teacher/plans');
  return { ok: true, problems: [], message: 'Saved.' };
}
