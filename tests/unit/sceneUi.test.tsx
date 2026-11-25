import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Blob } from '@/components/blob/Blob';
import { Snow } from '@/components/blob/Snow';
import { NudgeLine } from '@/components/blob/NudgeLine';
import { PokeBlob } from '@/app/(kid)/home/PokeBlob';

vi.mock('@/lib/sound', () => ({ playSound: vi.fn() }));

function media(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
}
function hour(h: number) {
  vi.spyOn(Date.prototype, 'getHours').mockReturnValue(h);
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); try { sessionStorage.clear(); } catch {} });

describe('Blob hats and pajamas', () => {
  it('draws the santa hat and the seollal bow', () => {
    const a = render(<Blob color="mint" mood="idle" size={100} hat="santa" />).container;
    expect(a.querySelector('[data-part="hat-santa"]')).not.toBeNull();
    const b = render(<Blob color="mint" mood="idle" size={100} hat="seollal" />).container;
    expect(b.querySelector('[data-part="hat-seollal"]')).not.toBeNull();
  });
  it('draws pajamas as an accessory, and nothing by default', () => {
    const a = render(<Blob color="mint" mood="idle" size={100} accessory="pajamas" />).container;
    expect(a.querySelector('[data-accessory="pajamas"]')).not.toBeNull();
    const b = render(<Blob color="mint" mood="idle" size={100} />).container;
    expect(b.querySelector('[data-accessory]')).toBeNull();
  });
});

describe('Snow', () => {
  it('renders a decorative, click-through flake layer', async () => {
    media(false);
    const { container } = render(<Snow />);
    const layer = container.querySelector('[data-snow]') as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.querySelectorAll('[data-flake]').length).toBeGreaterThan(5);
    expect(layer.querySelectorAll('[data-flake]').length).toBeLessThan(25);
  });
  it('is absent under reduced motion', () => {
    media(true);
    const { container } = render(<Snow />);
    expect(container.querySelector('[data-snow]')).toBeNull();
  });
});

describe('NudgeLine', () => {
  it('is empty before mount-time logic and says nothing in the afternoon', () => {
    media(false); hour(15);
    const { container } = render(<NudgeLine />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('[data-nudge-slot]')).not.toBeNull(); // the slot is always reserved
  });
  it('says good morning before 9', () => {
    media(false); hour(8);
    render(<NudgeLine />);
    expect(screen.getByText('Good morning!')).toBeInTheDocument();
  });
  it('tells kids it is bedtime from 9 pm', () => {
    media(false); hour(21);
    render(<NudgeLine />);
    expect(screen.getByText('Time for bed, see you tomorrow!')).toBeInTheDocument();
  });
});

describe('PokeBlob scene', () => {
  it('wears pajamas at bedtime and the hat it is given', () => {
    media(false); hour(22);
    const { container } = render(<PokeBlob color="sky" hat="santa" />);
    expect(container.querySelector('[data-accessory="pajamas"]')).not.toBeNull();
    expect(container.querySelector('[data-part="hat-santa"]')).not.toBeNull();
  });
  it('stretches sleepily in the morning, then goes back to idle', () => {
    media(false); hour(7);
    vi.useFakeTimers();
    const { container } = render(<PokeBlob color="sky" />);
    const mood = () => container.querySelector('[data-mood]')!.getAttribute('data-mood');
    expect(mood()).toBe('sleepy');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(mood()).toBe('idle');
  });
  it('skips the stretch under reduced motion', () => {
    media(true); hour(7);
    const { container } = render(<PokeBlob color="sky" />);
    expect(container.querySelector('[data-mood]')!.getAttribute('data-mood')).toBe('idle');
  });
  it('no pajamas in the afternoon', () => {
    media(false); hour(14);
    const { container } = render(<PokeBlob color="sky" />);
    expect(container.querySelector('[data-accessory]')).toBeNull();
  });
});
