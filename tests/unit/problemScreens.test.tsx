import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { OfflineGate } from '@/components/ui/OfflineGate';
import { MuteToggle } from '@/components/ui/MuteToggle';
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
import KidError from '@/app/(kid)/error';
import Loading from '@/app/(kid)/loading';
import { Blob } from '@/components/blob/Blob';

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => v });
}
afterEach(() => { setOnline(true); vi.restoreAllMocks(); localStorage.clear(); });

function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>count {n}</button>;
}

describe('OfflineGate', () => {
  it('shows nothing extra while online', () => {
    setOnline(true);
    render(<OfflineGate><Counter /></OfflineGate>);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the umbrella screen when navigator.onLine is false, and hides it on the online event', () => {
    setOnline(false);
    render(<OfflineGate><Counter /></OfflineGate>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/internet/i);
    expect(alert.querySelector('[data-accessory="umbrella"]')).not.toBeNull();
    expect(alert.querySelector('[lang="ko"]')).not.toBeNull();
    act(() => { setOnline(true); window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reacts to offline and online events', () => {
    setOnline(true);
    render(<OfflineGate><Counter /></OfflineGate>);
    act(() => { setOnline(false); window.dispatchEvent(new Event('offline')); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => { setOnline(true); window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps its children mounted (and their state) while offline', () => {
    setOnline(true);
    render(<OfflineGate><Counter /></OfflineGate>);
    fireEvent.click(screen.getByText('count 0'));
    expect(screen.getByText('count 1')).toBeInTheDocument();
    act(() => { setOnline(false); window.dispatchEvent(new Event('offline')); });
    expect(screen.getByText('count 1', { selector: 'button' })).toBeInTheDocument();
    act(() => { setOnline(true); window.dispatchEvent(new Event('online')); });
    expect(screen.getByText('count 1')).toBeInTheDocument();
  });
});

describe('kid error screen', () => {
  it('shows a calm message with a Korean line, and Try again refreshes and resets', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    render(<KidError error={new Error('boom')} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.querySelector('[lang="ko"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refresh).toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('kid loading screen', () => {
  it('announces itself politely and shows a blob', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(document.querySelector('[data-mood]')).not.toBeNull();
  });
});

describe('Blob accessory', () => {
  it('draws an umbrella only when asked', () => {
    const { container, rerender } = render(<Blob color="mint" mood="idle" size={100} />);
    expect(container.querySelector('[data-accessory="umbrella"]')).toBeNull();
    rerender(<Blob color="mint" mood="idle" size={100} accessory="umbrella" />);
    expect(container.querySelector('[data-accessory="umbrella"]')).not.toBeNull();
  });
});

describe('MuteToggle', () => {
  beforeEach(() => localStorage.clear());

  it('is a pressed-state button that flips the label and persists', () => {
    render(<MuteToggle />);
    const btn = screen.getByRole('button', { name: 'Mute sounds' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    const on = screen.getByRole('button', { name: 'Turn sounds on' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('wp_muted')).toBe('1');
    fireEvent.click(on);
    expect(localStorage.getItem('wp_muted')).toBe('0');
  });

  it('says read-aloud stays on', () => {
    render(<MuteToggle />);
    const btn = screen.getByRole('button', { name: 'Mute sounds' });
    const id = btn.getAttribute('aria-describedby')!;
    expect(document.getElementById(id)).toHaveTextContent(/read-aloud|read aloud/i);
  });

  it('still toggles when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    render(<MuteToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute sounds' }));
    expect(screen.getByRole('button', { name: 'Turn sounds on' })).toBeInTheDocument();
  });
});
