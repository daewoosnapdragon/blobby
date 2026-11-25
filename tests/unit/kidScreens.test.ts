import { describe, expect, it, vi } from 'vitest';
import { opensLabel, weekTileColor } from '@/lib/weekLabels';
import { postWithRetry } from '@/lib/kidApi';
import { lessonOutcome } from '@/lib/lessonOutcome';

describe('opensLabel', () => {
  it('uses the weekday within 6 days, else a short date', () => {
    // 2026-12-24 is a Thursday
    expect(opensLabel('2026-12-25', '2026-12-24')).toBe('Opens Friday');
    expect(opensLabel('2026-12-28', '2026-12-24')).toBe('Opens Monday');
    expect(opensLabel('2026-12-30', '2026-12-24')).toBe('Opens Wednesday'); // 6 days
    expect(opensLabel('2026-12-31', '2026-12-24')).toBe('Opens Dec 31'); // 7 days
    expect(opensLabel('2027-01-05', '2026-12-24')).toBe('Opens Jan 5');
  });
  it('a week with no date is coming soon', () => {
    expect(opensLabel(null, '2026-12-24')).toBe('Opens soon');
  });
});

describe('weekTileColor', () => {
  it('rotates mint, pink, blue, yellow', () => {
    expect([0, 1, 2, 3, 4].map(weekTileColor)).toEqual(['#B7E1D1', '#FFB5C1', '#A9D3FF', '#FFE59A', '#B7E1D1']);
  });
});

describe('postWithRetry', () => {
  const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

  it('retries network errors and 5xx up to 3 times with the same body', async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(ok({ error: 'x' }, 503))
      .mockResolvedValueOnce(ok({ starsAwarded: 0 }));
    const r = await postWithRetry('/api/attempt', { a: 1 }, { fetchImpl: f, delayMs: 0 });
    expect(r).toEqual({ status: 200, data: { starsAwarded: 0 } });
    expect(f).toHaveBeenCalledTimes(3);
    for (const call of f.mock.calls) expect(call[1].body).toBe(JSON.stringify({ a: 1 }));
  });

  it('gives up after 1 try + 3 retries', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const r = await postWithRetry('/x', {}, { fetchImpl: f, delayMs: 0 });
    expect(r).toEqual({ status: 0, data: null });
    expect(f).toHaveBeenCalledTimes(4);
  });

  it('does not retry a 4xx (401 goes straight back)', async () => {
    const f = vi.fn().mockResolvedValue(ok({ error: 'unauthorized' }, 401));
    const r = await postWithRetry('/x', {}, { fetchImpl: f, delayMs: 0 });
    expect(r.status).toBe(401);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('lessonOutcome (R24)', () => {
  const page = { studentId: 'A', lessonDone: false, weekDone: false, otherLessonsDone: false };

  it('first completion: stars and no week done', () => {
    expect(lessonOutcome(page, { studentId: 'A', starsAwarded: 10, weekDone: false })).toEqual({ firstTime: true, toWeekDone: false });
  });

  it('a retried completion ({0,false}) still counts as the first time, and still reaches week done', () => {
    const last = { ...page, otherLessonsDone: true };
    expect(lessonOutcome(last, { studentId: 'A', starsAwarded: 0, weekDone: false })).toEqual({ firstTime: true, toWeekDone: true });
  });

  it('redoing a finished lesson in a finished week: no stars, no week done', () => {
    const redo = { ...page, lessonDone: true, weekDone: true, otherLessonsDone: true };
    expect(lessonOutcome(redo, { studentId: 'A', starsAwarded: 0, weekDone: false })).toEqual({ firstTime: false, toWeekDone: false });
  });

  it('the server finishing the week wins even if the page thought other lessons were undone', () => {
    expect(lessonOutcome(page, { studentId: 'A', starsAwarded: 20, weekDone: true })).toEqual({ firstTime: true, toWeekDone: true });
  });

  it('after a kid switch, only the server result counts', () => {
    const last = { ...page, otherLessonsDone: true };
    expect(lessonOutcome(last, { studentId: 'B', starsAwarded: 0, weekDone: false })).toEqual({ firstTime: false, toWeekDone: false });
    expect(lessonOutcome(last, { studentId: 'B', starsAwarded: 10, weekDone: false })).toEqual({ firstTime: true, toWeekDone: false });
  });
});
