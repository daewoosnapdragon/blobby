import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CardsSheet, type CardData } from '@/app/teacher/class/[id]/cards/CardsSheet';
import { qrSvg } from '@/lib/qr';
import { koCards } from '@/lib/copy.ko';

const cards: CardData[] = [
  { id: 's1', name: 'Mina', blobColor: null, url: 'https://blobby.test/s/secret-mina', svg: '<svg data-x="1"></svg>' },
  { id: 's2', name: 'Leo', blobColor: 'mint', url: 'https://blobby.test/s/secret-leo', svg: '<svg data-x="2"></svg>' },
];

describe('CardsSheet', () => {
  it('renders name, QR url + svg, class code, site address and Korean help on each card', () => {
    render(<CardsSheet cards={cards} classCode="ABC234" siteAddress="blobby.test" />);
    const els = screen.getAllByRole('listitem');
    expect(els).toHaveLength(2);
    const mina = within(els[0]);
    expect(mina.getByText('Mina')).toBeInTheDocument();
    expect(mina.getByText('ABC234')).toBeInTheDocument();
    expect(mina.getByText('blobby.test')).toBeInTheDocument();
    for (const line of koCards.help) expect(mina.getByText(line)).toBeInTheDocument();
    const qr = els[0].querySelector('[data-qr-url]')!;
    expect(qr.getAttribute('data-qr-url')).toBe('https://blobby.test/s/secret-mina');
    expect(qr.querySelector('svg')).not.toBeNull();
    expect(els[1].querySelector('[data-qr-url]')!.getAttribute('data-qr-url')).toBe('https://blobby.test/s/secret-leo');
  });

  it('draws the blob in the kid color, or none when no color is chosen', () => {
    render(<CardsSheet cards={cards} classCode="ABC234" siteAddress="blobby.test" />);
    const els = screen.getAllByRole('listitem');
    expect(els[0].querySelector('[data-testid="card-blob"]')).toBeNull();
    expect(els[1].querySelector('[data-testid="card-blob"]')).not.toBeNull();
  });
});

describe('qrSvg', () => {
  it('returns an svg with a quiet zone', async () => {
    const svg = await qrSvg('https://blobby.test/s/abc');
    expect(svg.startsWith('<svg')).toBe(true);
    // qrcode's margin of 4 modules: the first dark module never starts at 0
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(svg).toMatch(/M(4|[5-9]) /);
  });
});

describe('appOrigin', () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { ...env };
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('next/headers', () => ({ headers: async () => new Headers({ host: 'req.host:3000' }) }));
  });
  afterEach(() => { for (const k of ['APP_URL', 'NODE_ENV']) { if (saved[k] === undefined) delete env[k]; else env[k] = saved[k]; } });

  it('uses APP_URL without a trailing slash', async () => {
    env.APP_URL = 'https://blobby.test/'; env.NODE_ENV = 'production';
    const { appOrigin } = await import('@/lib/teacherUrl');
    expect(await appOrigin()).toBe('https://blobby.test');
  });
  it('fails closed in production without APP_URL', async () => {
    delete env.APP_URL; env.NODE_ENV = 'production';
    const { appOrigin, MissingAppUrlError } = await import('@/lib/teacherUrl');
    await expect(appOrigin()).rejects.toBeInstanceOf(MissingAppUrlError);
  });
  it('falls back to the request host outside production', async () => {
    delete env.APP_URL; env.NODE_ENV = 'development';
    const { appOrigin } = await import('@/lib/teacherUrl');
    expect(await appOrigin()).toBe('https://req.host:3000');
  });
});

describe('requestLink', () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { ...env };
  afterEach(() => { for (const k of ['APP_URL', 'NODE_ENV', 'TEACHER_EMAILS']) { if (saved[k] === undefined) delete env[k]; else env[k] = saved[k]; } });

  async function run(nodeEnv: string, appUrl?: string) {
    vi.resetModules();
    const signInWithOtp = vi.fn(async () => ({}));
    vi.doMock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`redirect:${u}`); } }));
    vi.doMock('next/cache', () => ({ revalidatePath: () => undefined }));
    vi.doMock('next/headers', () => ({ headers: async () => new Headers({ host: 'localhost:3000' }) }));
    vi.doMock('@/lib/supabase/server', () => ({ teacherSupabase: async () => ({ auth: { signInWithOtp } }), requireTeacher: async () => 'k@x.org' }));
    vi.doMock('@/lib/db/kid', () => ({ NotFoundError: class extends Error {} }));
    vi.doMock('@/lib/db/teacher', () => ({ setDisplayName: vi.fn(), studentDetail: vi.fn(), reissueLink: vi.fn(), DISPLAY_NAME_MAX: 40 }));
    env.TEACHER_EMAILS = 'kyla@school.org'; env.NODE_ENV = nodeEnv;
    if (appUrl) env.APP_URL = appUrl; else delete env.APP_URL;
    const { requestLink } = await import('@/app/teacher/actions');
    const fd = new FormData(); fd.set('email', 'kyla@school.org');
    await expect(requestLink(fd)).rejects.toThrow('redirect:/teacher/login?sent=1');
    return signInWithOtp;
  }

  it('never creates users and redirects to APP_URL', async () => {
    const otp = await run('production', 'https://blobby.test');
    expect(otp).toHaveBeenCalledWith({ email: 'kyla@school.org', options: { shouldCreateUser: false, emailRedirectTo: 'https://blobby.test/teacher/auth/callback' } });
  });
  it('sends nothing in production when APP_URL is missing, and answers neutrally', async () => {
    expect(await run('production')).not.toHaveBeenCalled();
  });
});
