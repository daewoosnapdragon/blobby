import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePracticePing } from '@/components/usePracticePing';

let visible = 'visible';
const fetchMock = vi.fn();
const calls = () => fetchMock.mock.calls.filter((c) => c[0] === '/api/ping').length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-10T03:00:00Z'));
  visible = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible });
  fetchMock.mockReset().mockResolvedValue({ status: 204 });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usePracticePing', () => {
  it('pings every 30s while visible and the kid interacted in the last 60s', () => {
    renderHook(() => usePracticePing());
    document.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(30_000);
    expect(calls()).toBe(1);
    vi.advanceTimersByTime(30_000); // 60s since the tap: still counts
    expect(calls()).toBe(2);
  });

  it('does not ping without recent interaction (page just open, or idle for over 60s)', () => {
    renderHook(() => usePracticePing());
    vi.advanceTimersByTime(30_000);
    expect(calls()).toBe(0);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(30_000);
    expect(calls()).toBe(1);
    vi.advanceTimersByTime(30_000); // 60s after keydown, still ok
    expect(calls()).toBe(2);
    vi.advanceTimersByTime(30_000); // 90s: idle
    expect(calls()).toBe(2);
  });

  it('does not ping while the tab is hidden', () => {
    renderHook(() => usePracticePing());
    document.dispatchEvent(new Event('pointerdown'));
    visible = 'hidden';
    vi.advanceTimersByTime(30_000);
    expect(calls()).toBe(0);
    visible = 'visible';
    document.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(30_000);
    expect(calls()).toBe(1);
  });

  it('stops when unmounted and swallows failures', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { unmount } = renderHook(() => usePracticePing());
    document.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0); // no unhandled rejection
    expect(calls()).toBe(1);
    unmount();
    document.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(120_000);
    expect(calls()).toBe(1);
  });
});
