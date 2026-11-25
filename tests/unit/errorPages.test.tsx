import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import TeacherError from '@/app/teacher/error';
import GlobalError from '@/app/global-error';
import { reloadPage } from '@/lib/reloadPage';
import { koKid } from '@/lib/copy.ko';
import KidError from '@/app/(kid)/error';

afterEach(() => { vi.restoreAllMocks(); refresh.mockReset(); });

function err(digest?: string) {
  return Object.assign(new Error('boom'), digest ? { digest } : {});
}

describe('teacher error page', () => {
  it('is calm, English, shows the digest, and Try again refreshes server data then resets', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    render(<TeacherError error={err('abc123')} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/check the app.s settings in Vercel/i)).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders without a digest', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<TeacherError error={err()} reset={() => {}} />);
    expect(screen.queryByText(/support code/i)).toBeNull();
  });
});

describe('global error page', () => {
  it('is calm for kids and parents (no Vercel), shows the digest, and Try again reloads the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const reload = vi.spyOn(reloadPage, 'run').mockImplementation(() => {});
    // <html> inside a div is a React warning only; render the body content.
    render(<GlobalError error={err('d1g3st')} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/vercel/i)).toBeNull();
    expect(screen.queryByText(/settings/i)).toBeNull();
    expect(screen.getByText(/d1g3st/)).toBeInTheDocument();
    expect(document.querySelector('p[lang="ko"]')?.textContent).toBe(koKid.error);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('kid error page', () => {
  it('shows the digest small when there is one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<KidError error={err('kid77')} reset={() => {}} />);
    expect(screen.getByText(/kid77/)).toBeInTheDocument();
  });

  it('Try again refreshes server data then resets the boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    render(<KidError error={err()} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
