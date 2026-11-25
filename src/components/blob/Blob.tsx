import styles from './Blob.module.css';

export type BlobColor = 'sunny' | 'peach' | 'pink' | 'mint' | 'sky' | 'grape';
export type Mood = 'idle' | 'happy' | 'oops' | 'sleepy';
export type Reaction = 'hop' | 'wobble' | 'squish' | 'cheer';
export type Hat = 'santa' | 'seollal';
export type Accessory = 'umbrella' | 'pajamas' | null;

export const BLOB_HEX: Record<BlobColor, string> = {
  sunny: '#FFD95A',
  peach: '#FFC9A8',
  pink: '#FFB5C1',
  mint: '#B7E1D1',
  sky: '#A9D3FF',
  grape: '#D9CCF5',
};

const BODY_PATH =
  'M58 8 C84 2 112 18 114 48 C116 78 98 104 64 106 C30 108 4 88 6 58 C8 30 30 14 58 8 Z';
const INK = '#1F1F1F';
const CHEEK = '#FFB5C1';
const DROP = '#A9D3FF';

type Props = {
  color: BlobColor;
  mood: Mood;
  /** px, or any CSS width (e.g. "var(--hero-blob, 196px)") so layouts can size the blob per breakpoint */
  size: number | string;
  reaction?: Reaction | null;
  hat?: Hat | null;
  /** umbrella (offline) or pajamas (bedtime nudge) */
  accessory?: Accessory;
};

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return (
        <>
          <path data-part="arc-eyes" d="M43 52 q7 -9 14 0 M63 50 q7 -9 14 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path data-part="smile" d="M52 66 q8 7 16 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="38" cy="64" rx="6" ry="3.5" fill={CHEEK} />
          <ellipse cx="82" cy="62" rx="6" ry="3.5" fill={CHEEK} />
        </>
      );
    case 'oops':
      return (
        <>
          <circle cx="50" cy="52" r="4" fill={INK} />
          <circle cx="70" cy="50" r="4" fill={INK} />
          <ellipse cx="60" cy="68" rx="4" ry="5" fill={INK} />
          <path data-part="sweat-drop" className={styles.pop} d="M98 24 q-6 9 0 13 q6 -4 0 -13z" fill={DROP} />
          <ellipse cx="38" cy="66" rx="6" ry="3.5" fill={CHEEK} />
          <ellipse cx="82" cy="64" rx="6" ry="3.5" fill={CHEEK} />
        </>
      );
    case 'sleepy':
      return (
        <>
          <path data-part="sleepy-eyes" d="M41 54 q7 5 14 0 M63 52 q7 5 14 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M55 68 q5 3 10 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="38" cy="64" rx="6" ry="3.5" fill={CHEEK} />
          <ellipse cx="82" cy="62" rx="6" ry="3.5" fill={CHEEK} />
        </>
      );
    default:
      return (
        <>
          <g className={styles.glance}>
            <g data-part="blink" className={styles.blink}>
              <ellipse cx="46" cy="48" rx="5" ry="7" fill={INK} />
              <ellipse cx="66" cy="46" rx="5" ry="7" fill={INK} />
            </g>
          </g>
          <ellipse cx="36" cy="60" rx="6" ry="3.5" fill={CHEEK} />
          <ellipse cx="76" cy="58" rx="6" ry="3.5" fill={CHEEK} />
        </>
      );
  }
}

function HatArt({ hat }: { hat: Hat }) {
  if (hat === 'santa') {
    return (
      <g data-part="hat-santa" transform="rotate(-12 58 14)">
        <path d="M36 20 C40 -2 66 -6 82 14 C70 10 52 12 36 20 Z" fill="#E5484D" />
        <path d="M30 22 q28 -12 56 -2 q3 9 -3 10 q-26 -8 -50 2 q-6 -2 -3 -10z" fill="#FFFFFF" />
        <circle cx="84" cy="14" r="6" fill="#FFFFFF" />
      </g>
    );
  }
  return (
    <g data-part="hat-seollal" transform="translate(84 14) rotate(18)">
      <path d="M0 0 C-10 -12 -18 -4 -14 4 C-10 8 -4 4 0 0 Z" fill="#E5484D" />
      <path d="M0 0 C10 -12 18 -4 14 4 C10 8 4 4 0 0 Z" fill="#E5484D" />
      <path d="M-2 2 L-9 16 M2 2 L9 16" stroke="#3B6FD4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="0" cy="0" r="3.5" fill="#FFD95A" />
    </g>
  );
}

/** A small umbrella held at the blob's right side, tipped toward its head. The canopy avoids the blob's own color. */
function UmbrellaArt({ color }: { color: BlobColor }) {
  const canopy = color === 'sky' ? '#FFB5C1' : '#A9D3FF';
  return (
    <g data-accessory="umbrella" transform="rotate(-18 112 60)">
      <path d="M112 8 V62" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M78 8 C78 -14 146 -14 146 8 q-5.7 -5 -11.3 0 q-5.7 -5 -11.4 0 q-5.6 -5 -11.3 0 q-5.7 -5 -11.4 0 q-5.6 -5 -11.3 0 q-5.7 -5 -11.3 0 Z" fill={canopy} />
      <path d="M112 -8 C105 -8 100 -2 100 7 M112 -8 C119 -8 124 -2 124 7" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="112" cy="-9" r="2.2" fill={INK} />
      <ellipse cx="112" cy="62" rx="7" ry="6.5" fill={BLOB_HEX[color]} stroke="#1F1F1F" strokeOpacity="0.18" strokeWidth="1.5" />
    </g>
  );
}

/** Striped pajama top over the lower body, clipped to the blob so it follows the curves. Stripes avoid the blob's own color. */
function PajamasArt({ color }: { color: BlobColor }) {
  const base = color === 'sky' ? '#FFB5C1' : '#A9D3FF';
  return (
    <g data-accessory="pajamas">
      <clipPath id="blob-pj-clip"><path d={BODY_PATH} /></clipPath>
      <g clipPath="url(#blob-pj-clip)">
        <rect x="0" y="72" width="120" height="44" fill={base} />
        {[14, 38, 62, 86, 110].map((x) => <rect key={x} x={x - 5} y="72" width="10" height="44" fill="#FFFFFF" fillOpacity="0.85" />)}
        <path d="M0 72 q60 9 120 0" stroke={INK} strokeOpacity="0.18" strokeWidth="2" fill="none" />
      </g>
      <circle cx="60" cy="82" r="2.4" fill={INK} fillOpacity="0.55" />
      <circle cx="60" cy="92" r="2.4" fill={INK} fillOpacity="0.55" />
    </g>
  );
}

export function Blob({ color, mood, size, reaction = null, hat = null, accessory = null }: Props) {
  const cls = [styles.root, reaction ? styles[reaction] : ''].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      aria-hidden="true"
      data-mood={mood}
      data-reaction={reaction ?? undefined}
      style={{ width: size, height: typeof size === 'number' ? (size * 112) / 120 : undefined, aspectRatio: '120 / 112' }}
    >
      <svg className={styles.breathe} width="100%" height="100%" viewBox="0 0 120 112" overflow="visible">
        <path data-part="body" d={BODY_PATH} fill={BLOB_HEX[color]} />
        <Face mood={mood} />
        {hat ? <HatArt hat={hat} /> : null}
        {accessory === 'pajamas' ? <PajamasArt color={color} /> : null}
        {accessory === 'umbrella' ? <UmbrellaArt color={color} /> : null}
      </svg>
    </div>
  );
}
