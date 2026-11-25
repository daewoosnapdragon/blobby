import { BLOB_HEX, type BlobColor } from './Blob';
import styles from './Blob.module.css';

/**
 * The small blob from the mockups' swatches, top bar and rail: body and eyes, no cheeks.
 * Static unless `blink` is set ("late" offsets it from the big blob, as in D-Home).
 */
export function MiniBlob({
  color, size, stroke = false, blink = false, breathe = false, eyes = 'big',
}: {
  color: BlobColor; size: number; stroke?: boolean; blink?: false | 'on' | 'late'; breathe?: boolean; eyes?: 'big' | 'small';
}) {
  const [rx, ry, y1, y2] = eyes === 'big' ? [7, 9, 54, 52] : [6, 8, 52, 50];
  return (
    <svg
      className={breathe ? styles.breathe : undefined}
      width={size}
      height={(size * 112) / 120}
      viewBox="0 0 120 112"
      aria-hidden="true"
      overflow="visible"
    >
      <path
        data-part="body"
        d="M58 8 C84 2 112 18 114 48 C116 78 98 104 64 106 C30 108 4 88 6 58 C8 30 30 14 58 8 Z"
        fill={BLOB_HEX[color]}
        stroke={stroke ? '#1F1F1F' : undefined}
        strokeWidth={stroke ? 3 : undefined}
      />
      <g className={blink ? `${styles.blink} ${blink === 'late' ? styles.late : ''}` : undefined}>
        <ellipse cx="48" cy={y1} rx={rx} ry={ry} fill="#1F1F1F" />
        <ellipse cx={eyes === 'big' ? 72 : 70} cy={y2} rx={rx} ry={ry} fill="#1F1F1F" />
      </g>
    </svg>
  );
}
