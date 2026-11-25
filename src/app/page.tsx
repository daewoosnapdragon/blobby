import { Blob } from '@/components/blob/Blob';

export default function Home() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
      <Blob color="sunny" mood="idle" size={196} />
    </main>
  );
}
