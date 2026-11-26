'use client';
import { useState } from 'react';
import { pictureSrc } from '@/lib/pictures';

/** The question's key-noun picture. Decorative (the words carry the meaning); a missing file just disappears. */
export function QuestionPicture({ name, size = 96, className }: { name: string | undefined; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!name || broken) return null;
  // eslint-disable-next-line @next/next/no-img-element -- small static SVGs from /public
  return <img src={pictureSrc(name)} alt="" width={size} height={size} className={className} onError={() => setBroken(true)} draggable={false} />;
}
