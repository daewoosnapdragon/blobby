import { redirect } from 'next/navigation';
import { studentFromRequest } from '@/lib/db/kid';
import { toBlobColor } from '@/lib/blobColors';
import { PickBlob } from './PickBlob';

export const dynamic = 'force-dynamic';

export default async function Pick() {
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  return <PickBlob name={student.display_name} initial={toBlobColor(student.blob_color)} />;
}
