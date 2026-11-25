import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TeacherError from '@/app/teacher/error';
import GlobalError from '@/app/global-error';
import KidError from '@/app/(kid)/error';

afterEach(() => { vi.restoreAllMocks(); });

function err(digest?: string) {
  return Object.assign(new Error('boom'), digest ? { digest } : {});
}

describe('teacher error page', () => {
  it('is calm, English, shows the digest, and Try again calls reset', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    render(<TeacherError error={err('abc123')} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/check the app.s settings in Vercel/i)).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders without a digest', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<TeacherError error={err()} reset={() => {}} />);
    expect(screen.queryByText(/support code/i)).toBeNull();
  });
});

describe('global error page', () => {
  it('renders its own html shell with a message, digest and Try again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    // <html> inside a div is a React warning only; render the body content.
    render(<GlobalError error={err("d1g3st")} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/d1g3st/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('kid error page', () => {
  it('shows the digest small when there is one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<KidError error={err('kid77')} reset={() => {}} />);
    expect(screen.getByText(/kid77/)).toBeInTheDocument();
  });
});
