import { OfflineGate } from '@/components/ui/OfflineGate';
import { SoundPreloader } from '@/components/ui/SoundPreloader';
import { PracticeBar } from '@/components/ui/PracticeBar';
import { studentFromRequest } from '@/lib/db/kid';

export default async function KidLayout({ children }: { children: React.ReactNode }) {
  const student = await studentFromRequest().catch(() => null);
  return (
    <OfflineGate>
      <SoundPreloader />
      {student?.is_preview ? <PracticeBar classId={student.class_id} /> : null}
      {children}
    </OfflineGate>
  );
}
