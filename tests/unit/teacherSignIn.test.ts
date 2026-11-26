import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
};
const server = vi.hoisted(() => ({ teacherSupabase: vi.fn(), requireTeacher: vi.fn() }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error('NOT_FOUND'); },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => server);
vi.mock('@/lib/db/teacher', () => ({}));

import { changePassword, saveTeacherName, signInWithPassword } from '@/app/teacher/actions';

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  process.env.TEACHER_EMAILS = 'kyla@example.com';
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.signOut.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ data: {}, error: null });
  server.teacherSupabase.mockReset().mockResolvedValue({ auth });
  server.requireTeacher.mockReset().mockResolvedValue('kyla@example.com');
});

describe('signInWithPassword', () => {
  it('signs an allowlisted teacher in and goes to /teacher', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { email: 'kyla@example.com' } }, error: null });
    await expect(signInWithPassword(form({ email: ' Kyla@Example.com ', password: 'secret123' }))).rejects.toThrow(/^REDIRECT:\/teacher$/);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'kyla@example.com', password: 'secret123' });
  });

  it('never calls Supabase for an email not on the list', async () => {
    await expect(signInWithPassword(form({ email: 'stranger@example.com', password: 'secret123' })))
      .rejects.toThrow('REDIRECT:/teacher/login?error=signin');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('wrong password gives the neutral error', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'invalid_credentials' } });
    await expect(signInWithPassword(form({ email: 'kyla@example.com', password: 'wrongpass' })))
      .rejects.toThrow('REDIRECT:/teacher/login?error=signin');
  });

  it('signs out a Supabase user who is not on the list', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { email: 'other@example.com' } }, error: null });
    await expect(signInWithPassword(form({ email: 'kyla@example.com', password: 'secret123' })))
      .rejects.toThrow('REDIRECT:/teacher/login?error=signin');
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('fails neutrally when Supabase throws', async () => {
    auth.signInWithPassword.mockRejectedValue(new Error('network'));
    await expect(signInWithPassword(form({ email: 'kyla@example.com', password: 'secret123' })))
      .rejects.toThrow('REDIRECT:/teacher/login?error=signin');
  });

  it('fails neutrally when Supabase is not configured', async () => {
    server.teacherSupabase.mockResolvedValue(null);
    await expect(signInWithPassword(form({ email: 'kyla@example.com', password: 'secret123' })))
      .rejects.toThrow('REDIRECT:/teacher/login?error=signin');
  });

  it('empty password fails without calling Supabase', async () => {
    await expect(signInWithPassword(form({ email: 'kyla@example.com', password: '' })))
      .rejects.toThrow('REDIRECT:/teacher/login?error=signin');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('saveTeacherName', () => {
  it('saves a trimmed name and reports it', async () => {
    await expect(saveTeacherName(form({ name: '  Kyla ' }))).rejects.toThrow('REDIRECT:/teacher/account?saved=name');
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { display_name: 'Kyla' } });
  });

  it('rejects a blank name without saving', async () => {
    await expect(saveTeacherName(form({ name: '   ' }))).rejects.toThrow('REDIRECT:/teacher/account?error=name');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('reports a Supabase failure', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: { code: 'unexpected_failure' } });
    await expect(saveTeacherName(form({ name: 'Kyla' }))).rejects.toThrow('REDIRECT:/teacher/account?error=failed');
  });

  it('stops for someone who is not a teacher', async () => {
    server.requireTeacher.mockRejectedValue(new Error('REDIRECT:/teacher/login'));
    await expect(saveTeacherName(form({ name: 'Kyla' }))).rejects.toThrow('REDIRECT:/teacher/login');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  it('rejects two different passwords without saving', async () => {
    await expect(changePassword(form({ password: 'longenough', confirm: 'longenougH' }))).rejects.toThrow('REDIRECT:/teacher/account?error=mismatch');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a short password', async () => {
    await expect(changePassword(form({ password: 'short', confirm: 'short' }))).rejects.toThrow('REDIRECT:/teacher/account?error=short');
  });

  it('saves a good password', async () => {
    await expect(changePassword(form({ password: 'longenough', confirm: 'longenough' }))).rejects.toThrow('REDIRECT:/teacher/account?saved=password');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'longenough' });
  });

  it('explains when Supabase wants a recent sign-in', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: { code: 'reauthentication_needed' } });
    await expect(changePassword(form({ password: 'longenough', confirm: 'longenough' }))).rejects.toThrow('REDIRECT:/teacher/account?error=reauth');
  });

  it('stops for someone who is not a teacher', async () => {
    server.requireTeacher.mockRejectedValue(new Error('REDIRECT:/teacher/login'));
    await expect(changePassword(form({ password: 'longenough', confirm: 'longenough' }))).rejects.toThrow('REDIRECT:/teacher/login');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
