// Line icons in one style (2–2.5 stroke, round caps), copied from the D mockups.
const INK = '#1F1F1F';

export const STAR_PATH = 'M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z';
export const SPARKLE_PATH = 'M12 2 C13 8 16 11 22 12 C16 13 13 16 12 22 C11 16 8 13 2 12 C8 11 11 8 12 2Z';

export function StarIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={STAR_PATH} fill="#FFD95A" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Sparkle({ size = 26, color = '#F97940', className, style }: { size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={style}>
      <path d={SPARKLE_PATH} fill={color} />
    </svg>
  );
}

export function ArrowIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BackIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CheckIcon({ size = 32, strokeWidth = 2.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function LockIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#6B655F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function ChestIcon({ width = 52, height = 44, stroke = 4 }: { width?: number; height?: number; stroke?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 100" aria-hidden="true">
      <path d="M18 52 v-8 a42 26 0 0 1 84 0 v8 z" fill="#FFE59A" stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
      <rect x="18" y="52" width="84" height="38" rx="6" fill="#FFD95A" stroke={INK} strokeWidth={stroke} />
      <rect x="53" y="46" width="14" height="16" rx="4" fill={INK} />
    </svg>
  );
}

export function DiceIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="8.5" cy="8.5" r="1.3" fill={INK} />
      <circle cx="15.5" cy="15.5" r="1.3" fill={INK} />
      <circle cx="12" cy="12" r="1.3" fill={INK} />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4z" fill={INK} />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

export function RetryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </svg>
  );
}
