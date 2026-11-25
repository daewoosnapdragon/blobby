import { OfflineGate } from '@/components/ui/OfflineGate';
import { SoundPreloader } from '@/components/ui/SoundPreloader';

export default function KidLayout({ children }: { children: React.ReactNode }) {
  return (
    <OfflineGate>
      <SoundPreloader />
      {children}
    </OfflineGate>
  );
}
