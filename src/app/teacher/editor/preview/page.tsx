import type { Metadata } from 'next';
import { requireTeacher } from '@/lib/supabase/server';
import { PreviewFrame } from './PreviewFrame';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Preview' };

export default async function PreviewPage() {
  await requireTeacher();
  return <PreviewFrame />;
}
