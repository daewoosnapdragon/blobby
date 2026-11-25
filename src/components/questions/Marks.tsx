// Right/wrong marks inside choice dots, so feedback is never color alone (spec 5.6).
export function MarkIcon({ mark }: { mark: 'right' | 'wrong' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={mark === 'right' ? 'M5 12.5l4.5 4.5L19 7.5' : 'M7 7l10 10M17 7L7 17'} />
    </svg>
  );
}
