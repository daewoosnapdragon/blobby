import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIGNIN_MIN_MS, holdUntil } from '@/lib/evenTiming';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('holdUntil', () => {
  it('waits until the minimum time since start has passed', async () => {
    const start = Date.now();
    let done = false;
    void holdUntil(start).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(SIGNIN_MIN_MS - 10);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(done).toBe(true);
  });

  it('does not wait when the minimum has already passed', async () => {
    const start = Date.now() - SIGNIN_MIN_MS - 5;
    let done = false;
    void holdUntil(start).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('is long enough to cover a Supabase round trip', () => expect(SIGNIN_MIN_MS).toBeGreaterThanOrEqual(800));
});
