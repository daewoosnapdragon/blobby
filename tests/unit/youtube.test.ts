import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkEmbeddable, parseYouTubeId, YOUTUBE_ID_RE } from '@/lib/youtube';

const ID = 'dQw4w9WgXcQ';
afterEach(() => vi.unstubAllGlobals());

describe('parseYouTubeId', () => {
  it.each([
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?t=30`],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&list=PL123&t=5s`],
    [`https://www.youtube.com/watch?feature=share&v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}?rel=0`],
    [`youtube.com/watch?v=${ID}`],
    [`  ${ID}  `],
    [ID],
  ])('finds the id in %s', (input) => expect(parseYouTubeId(input)).toBe(ID));

  it.each([[''], ['hello'], ['https://example.com/watch?v=' + ID], ['https://www.youtube.com/watch?v=short'], ['https://youtu.be/'], [ID + 'x'], ['https://vimeo.com/123456789']])(
    'rejects %s',
    (input) => expect(parseYouTubeId(input)).toBeNull(),
  );

  it('exports the id pattern', () => {
    expect(YOUTUBE_ID_RE.test(ID)).toBe(true);
    expect(YOUTUBE_ID_RE.test('abc')).toBe(false);
  });
});

describe('checkEmbeddable', () => {
  const mock = (status: number) => {
    const f = vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300 });
    vi.stubGlobal('fetch', f);
    return f;
  };

  it('200 is ok, with the id', async () => {
    const f = mock(200);
    expect(await checkEmbeddable(`https://youtu.be/${ID}`)).toEqual({ ok: true, id: ID });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('https://www.youtube.com/oembed?');
    expect(url).toContain('format=json');
    expect(decodeURIComponent(url)).toContain(`watch?v=${ID}`);
  });
  it('401 and 403 are not_embeddable', async () => {
    mock(401);
    expect(await checkEmbeddable(ID)).toEqual({ ok: false, reason: 'not_embeddable' });
    mock(403);
    expect(await checkEmbeddable(ID)).toEqual({ ok: false, reason: 'not_embeddable' });
  });
  it('404 and 400 are not_found', async () => {
    mock(404);
    expect(await checkEmbeddable(ID)).toEqual({ ok: false, reason: 'not_found' });
    mock(400);
    expect(await checkEmbeddable(ID)).toEqual({ ok: false, reason: 'not_found' });
  });
  it('a bad url never fetches', async () => {
    const f = mock(200);
    expect(await checkEmbeddable('https://example.com/x')).toEqual({ ok: false, reason: 'bad_url' });
    expect(f).not.toHaveBeenCalled();
  });
  it('a network failure is unreachable, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await checkEmbeddable(ID)).toEqual({ ok: false, reason: 'unreachable' });
  });
  it('gives the fetch an 8 second timeout and maps a timeout to unreachable', async () => {
    const ctl = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(ctl.signal);
    const f = vi.fn((_u: unknown, init?: RequestInit) => new Promise((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError')));
    }));
    vi.stubGlobal('fetch', f);
    const p = checkEmbeddable(ID);
    expect(timeout).toHaveBeenCalledWith(8000);
    expect(f.mock.calls[0][1]?.signal).toBe(ctl.signal);
    ctl.abort();
    expect(await p).toEqual({ ok: false, reason: 'unreachable' });
    timeout.mockRestore();
  });
});
