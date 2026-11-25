import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { useRecordAttempt, type FailedSave } from '@/components/questions/useRecordAttempt';
import { SaveRetry } from '@/components/questions/SaveRetry';

const KID = '00000000-0000-4000-8000-000000000002';
const Q = { id: '00000000-0000-4000-8000-0000000000aa' } as never;

let bodies: { clientAttemptId: string; correct: boolean }[];
beforeEach(() => {
  vi.useFakeTimers();
  bodies = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return impl();
  }));
}

describe('useRecordAttempt when every retry fails', () => {
  it('reports the failed save, and its retry resends the SAME clientAttemptId', async () => {
    stubFetch(() => Promise.reject(new TypeError('offline')));
    const onFailed = vi.fn<(f: FailedSave) => void>();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useRecordAttempt({ context: 'free', studentId: KID, onSignedOut: () => {}, onSaved, onFailed }));

    let done!: Promise<void>;
    act(() => { done = result.current(Q, true); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); await done; });
    expect(bodies).toHaveLength(4); // 1 try + 3 retries
    expect(new Set(bodies.map((b) => b.clientAttemptId)).size).toBe(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    const failed = onFailed.mock.calls[0][0];
    expect(failed.correct).toBe(true);

    // back online: the retry goes through with the same id and counts the server's star
    stubFetch(async () => new Response(JSON.stringify({ starsAwarded: 1, studentId: KID }), { status: 200 }));
    let ok = false;
    await act(async () => { ok = await failed.retry(); });
    expect(ok).toBe(true);
    expect(bodies.at(-1)!.clientAttemptId).toBe(bodies[0].clientAttemptId);
    expect(onSaved).toHaveBeenCalledWith({ starsAwarded: 1, studentId: KID });
  });

  it('a 5xx after all retries is a failed save too; a 4xx is not', async () => {
    stubFetch(async () => new Response('{}', { status: 503 }));
    const onFailed = vi.fn();
    const { result } = renderHook(() =>
      useRecordAttempt({ context: 'free', studentId: KID, onSignedOut: () => {}, onFailed }));
    let done!: Promise<void>;
    act(() => { done = result.current(Q, false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); await done; });
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed.mock.calls[0][0].correct).toBe(false);

    stubFetch(async () => new Response('{}', { status: 400 }));
    await act(async () => { await result.current(Q, true); });
    expect(onFailed).toHaveBeenCalledTimes(1);
  });
});

describe('SaveRetry', () => {
  it('renders nothing with no failed saves', () => {
    const { container } = render(<SaveRetry failed={[]} onRetry={() => {}} busy={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a tap to try again, and says how many when there are several', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<SaveRetry failed={[{ correct: true, retry: async () => true }]} onRetry={onRetry} busy={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Couldn’t save that one. Tap to try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    const two = [{ correct: true, retry: async () => true }, { correct: true, retry: async () => true }];
    rerender(<SaveRetry failed={two} onRetry={onRetry} busy={false} />);
    expect(screen.getByRole('button', { name: 'Couldn’t save 2 answers. Tap to try again' })).toBeInTheDocument();
    rerender(<SaveRetry failed={two} onRetry={onRetry} busy />);
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
  });
});
