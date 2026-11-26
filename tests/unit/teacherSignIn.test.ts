import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = {
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
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
const teacherDb = vi.hoisted(() => ({ practiceStudentFor: vi.fn(), resetPracticeStudent: vi.fn() }));
vi.mock('@/lib/db/teacher', () => teacherDb);
const jar = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => jar }));
const timing = vi.hoisted(() => ({ holdUntil: vi.fn(), SIGNIN_MIN_MS: 1000 }));
vi.mock('@/lib/evenTiming', () => timing);

import { changePassword, requestLink, resetPracticeStudentAction, saveTeacherName, signInWithPassword, tryAsStudent } from '@/app/teacher/actions';

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  process.env.TEACHER_EMAILS = 'kyla@example.com';
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.signOut.mockResolvedValue({ error: null });
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  auth.updateUser.mockResolvedValue({ data: {}, error: null });
  server.teacherSupabase.mockReset().mockResolvedValue({ auth });
  server.requireTeacher.mockReset().mockResolvedValue('kyla@example.com');
  timing.holdUntil.mockReset().mockResolvedValue(undefined);
});

describe('every sign-in answer takes the same minimum time', () => {
  it('holds a non-listed email as long as a real check', async () => {
    await expect(signInWithPassword(form({ email: 'stranger@example.com', password: 'secret123' }))).rejects.toThrow('REDIRECT');
    expect(timing.holdUntil).toHaveBeenCalledTimes(1);
  });

  it('holds a listed email too', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'invalid_credentials' } });
    await expect(signInWithPassword(form({ email: 'kyla@example.com', password: 'wrongpass' }))).rejects.toThrow('REDIRECT');
    expect(timing.holdUntil).toHaveBeenCalledTimes(1);
  });

  it('holds before answering, not after', async () => {
    timing.holdUntil.mockRejectedValue(new Error('HELD'));
    await expect(signInWithPassword(form({ email: 'stranger@example.com', password: 'secret123' }))).rejects.toThrow('HELD');
  });

  it('holds the email-link request for both kinds of email', async () => {
    for (const email of ['stranger@example.com', 'kyla@example.com']) {
      timing.holdUntil.mockClear();
      await expect(requestLink(form({ email }))).rejects.toThrow('REDIRECT:/teacher/login?sent=1');
      expect(timing.holdUntil).toHaveBeenCalledTimes(1);
    }
  });
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

describe('practice student actions', () => {
  const CLASS = '00000000-0000-4000-8000-0000000000c1';
  beforeEach(() => {
    process.env.SESSION_SECRET = 'unit-secret';
    teacherDb.practiceStudentFor.mockReset().mockResolvedValue({ id: '00000000-0000-4000-8000-0000000000aa', blob_color: null });
    teacherDb.resetPracticeStudent.mockReset().mockResolvedValue(undefined);
    jar.set.mockReset();
  });

  it('signs in as the practice student and goes to the blob picker the first time', async () => {
    await expect(tryAsStudent(form({ classId: CLASS }))).rejects.toThrow(/^REDIRECT:\/pick$/);
    expect(teacherDb.practiceStudentFor).toHaveBeenCalledWith(CLASS);
    expect(jar.set).toHaveBeenCalledWith('wp_student', expect.stringContaining('00000000-0000-4000-8000-0000000000aa.'), expect.any(Object));
  });

  it('does nothing for someone who is not a teacher', async () => {
    server.requireTeacher.mockRejectedValue(new Error('REDIRECT:/teacher/login'));
    await expect(tryAsStudent(form({ classId: CLASS }))).rejects.toThrow('REDIRECT:/teacher/login');
    await expect(resetPracticeStudentAction(form({ classId: CLASS }))).rejects.toThrow('REDIRECT:/teacher/login');
    expect(teacherDb.practiceStudentFor).not.toHaveBeenCalled();
    expect(teacherDb.resetPracticeStudent).not.toHaveBeenCalled();
    expect(jar.set).not.toHaveBeenCalled();
  });

  it('resets and returns to the class page', async () => {
    await expect(resetPracticeStudentAction(form({ classId: CLASS }))).rejects.toThrow(`REDIRECT:/teacher/class/${CLASS}?reset=1`);
    expect(teacherDb.resetPracticeStudent).toHaveBeenCalledWith(CLASS);
  });

  it('ignores a bad class id', async () => {
    await expect(tryAsStudent(form({ classId: 'nope' }))).rejects.toThrow('REDIRECT:/teacher');
    expect(teacherDb.practiceStudentFor).not.toHaveBeenCalled();
  });
});
