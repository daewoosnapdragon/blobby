import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WeekDone } from '@/app/(kid)/week-done/[weekId]/WeekDone';

vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }));

describe('WeekDone', () => {
  it('shows the skill exactly as entered (no lowercasing "I statements" or names)', () => {
    render(<WeekDone number={2} skill="I statements" weekStars={30} totalStars={50} color="mint" />);
    expect(screen.getByRole('heading', { name: 'Week 2 done!' })).toBeInTheDocument();
    expect(screen.getByText('I statements')).toBeInTheDocument();
    expect(screen.queryByText(/i statements/)).toBeNull();
  });
});
