import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeAudio = { src: string; currentTime: number; volume: number; preload: string; play: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> };
let made: FakeAudio[] = [];

function installAudio(playImpl: () => Promise<void> | undefined = () => Promise.resolve()) {
  made = [];
  vi.stubGlobal('Audio', function (this: FakeAudio, src?: string) {
    this.src = src ?? '';
    this.currentTime = 0;
    this.volume = 1;
    this.preload = '';
    this.play = vi.fn(playImpl);
    this.load = vi.fn();
    made.push(this);
  } as unknown as typeof Audio);
}

async function load() {
  vi.resetModules();
  return import('@/lib/sound');
}

beforeEach(() => {
  localStorage.clear();
  installAudio();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('playSound', () => {
  it('plays the named file when not muted', async () => {
    const { playSound } = await load();
    playSound('pop');
    expect(made).toHaveLength(1);
    expect(made[0].src).toBe('/sounds/pop.mp3');
    expect(made[0].play).toHaveBeenCalledTimes(1);
  });

  it('does nothing while muted', async () => {
    localStorage.setItem('wp_muted', '1');
    const { playSound, isMuted } = await load();
    expect(isMuted()).toBe(true);
    playSound('ding');
    expect(made.every((a) => a.play.mock.calls.length === 0)).toBe(true);
  });

  it('stops playing as soon as it is muted, and resumes when unmuted', async () => {
    const { playSound, setMuted } = await load();
    setMuted(true);
    playSound('boop');
    expect(made.every((a) => a.play.mock.calls.length === 0)).toBe(true);
    setMuted(false);
    playSound('boop');
    expect(made.some((a) => a.play.mock.calls.length === 1)).toBe(true);
  });

  it('restarts the same sound instead of stacking copies', async () => {
    const { playSound } = await load();
    playSound('squeak');
    made[0].currentTime = 0.1;
    playSound('squeak');
    expect(made).toHaveLength(1);
    expect(made[0].currentTime).toBe(0);
    expect(made[0].play).toHaveBeenCalledTimes(2);
  });

  it('swallows a rejected play() (autoplay policies)', async () => {
    installAudio(() => Promise.reject(new Error('NotAllowedError')));
    const { playSound } = await load();
    expect(() => playSound('pop')).not.toThrow();
    await Promise.resolve();
  });

  it('swallows a synchronous throw from play() or the Audio constructor', async () => {
    installAudio(() => { throw new Error('boom'); });
    const { playSound } = await load();
    expect(() => playSound('pop')).not.toThrow();
    vi.stubGlobal('Audio', function () { throw new Error('no audio'); });
    const again = await load();
    expect(() => again.playSound('ding')).not.toThrow();
  });

  it('is a no-op on the server (no window)', async () => {
    const { playSound } = await load();
    vi.stubGlobal('window', undefined);
    expect(() => playSound('pop')).not.toThrow();
    expect(made).toHaveLength(0);
  });
});

describe('mute persistence', () => {
  it('stores the choice under wp_muted', async () => {
    const { setMuted, isMuted } = await load();
    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(localStorage.getItem('wp_muted')).toBe('1');
    setMuted(false);
    expect(localStorage.getItem('wp_muted')).toBe('0');
  });

  it('reads the saved choice on a fresh load', async () => {
    localStorage.setItem('wp_muted', '1');
    const { isMuted } = await load();
    expect(isMuted()).toBe(true);
  });

  it('works when localStorage throws on every read and write', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const { isMuted, setMuted, playSound } = await load();
    expect(isMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
    expect(isMuted()).toBe(true); // remembered for this visit even though it could not be saved
    playSound('pop');
    expect(made.every((a) => a.play.mock.calls.length === 0)).toBe(true);
  });

  it('works when the localStorage accessor itself throws', async () => {
    vi.stubGlobal('localStorage', undefined);
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    const { isMuted, setMuted } = await load();
    expect(isMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
    expect(isMuted()).toBe(true);
    delete (window as unknown as Record<string, unknown>).localStorage;
  });
});

describe('preloadSounds / preloadOnFirstGesture', () => {
  it('preloadSounds creates every sound once', async () => {
    const { preloadSounds } = await load();
    preloadSounds();
    preloadSounds();
    expect(made.map((a) => a.src).sort()).toEqual(['/sounds/boop.mp3', '/sounds/ding.mp3', '/sounds/pop.mp3', '/sounds/squeak.mp3']);
  });

  it('preloads nothing until the first pointerdown, then exactly once', async () => {
    const { preloadOnFirstGesture } = await load();
    const stop = preloadOnFirstGesture();
    expect(made).toHaveLength(0);
    window.dispatchEvent(new Event('pointerdown'));
    expect(made).toHaveLength(4);
    window.dispatchEvent(new Event('pointerdown'));
    expect(made).toHaveLength(4);
    stop();
  });

  it('the cleanup removes the listener', async () => {
    const { preloadOnFirstGesture } = await load();
    preloadOnFirstGesture()();
    window.dispatchEvent(new Event('pointerdown'));
    expect(made).toHaveLength(0);
  });
});
