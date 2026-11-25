import { OfflineGate } from '@/components/ui/OfflineGate';

export default function KidLayout({ children }: { children: React.ReactNode }) {
  return <OfflineGate>{children}</OfflineGate>;
}
