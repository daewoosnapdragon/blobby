import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';

const makeMissingAudio = vi.fn();
vi.mock('@/app/teacher/audioActions', () => ({
  makeMissingAudio: () => makeMissingAudio(),
  missingAudioCount: vi.fn(async () => 0),
}));

import { MissingAudioCard } from '@/app/teacher/plans/MissingAudioCard';

beforeEach(() => { makeMissingAudio.mockReset(); });

describe('MissingAudioCard', () => {
  it('shows the count, or that every sentence has audio', () => {
    const { unmount } = render(<MissingAudioCard initialRemaining={252} />);
    expect(screen.getByRole('heading', { name: 'Read-aloud audio' })).toBeInTheDocument();
    expect(screen.getByText('252 sentences have no audio yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make missing audio' })).toBeEnabled();
    unmount();
    render(<MissingAudioCard initialRemaining={0} />);
    expect(screen.getByText('All sentences have audio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make missing audio' })).not.toBeInTheDocument();
  });

  it('keeps calling the action until nothing is left, showing progress', async () => {
    makeMissingAudio
      .mockResolvedValueOnce({ done: 20, remaining: 25 })
      .mockResolvedValueOnce({ done: 21, remaining: 4 })
      .mockResolvedValueOnce({ done: 4, remaining: 0 });
    render(<MissingAudioCard initialRemaining={45} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make missing audio' })); });
    await waitFor(() => expect(screen.getByText('All sentences have audio')).toBeInTheDocument());
    expect(makeMissingAudio).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Made 45 so far, 0 to go')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });

  it('Stop halts the loop after the call in flight', async () => {
    let release!: (v: { done: number; remaining: number }) => void;
    makeMissingAudio
      .mockResolvedValueOnce({ done: 20, remaining: 232 })
      .mockImplementationOnce(() => new Promise((r) => { release = r; }))
      .mockResolvedValue({ done: 20, remaining: 100 });
    render(<MissingAudioCard initialRemaining={252} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make missing audio' })); });
    await waitFor(() => expect(makeMissingAudio).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Made 20 so far, 232 to go')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make missing audio' })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    await act(async () => { release({ done: 20, remaining: 212 }); });
    await waitFor(() => expect(screen.getByText('Made 40 so far, 212 to go')).toBeInTheDocument());
    expect(makeMissingAudio).toHaveBeenCalledTimes(2);
    expect(screen.getByText('212 sentences have no audio yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make missing audio' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });

  it('stops and says so in plain words when making audio fails', async () => {
    makeMissingAudio
      .mockResolvedValueOnce({ done: 20, remaining: 30 })
      .mockResolvedValueOnce({ done: 2, remaining: 28, error: '500 internal_error from upstream' });
    render(<MissingAudioCard initialRemaining={50} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make missing audio' })); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("Couldn't make audio just now. What's made is saved. Try again in a minute."));
    expect(makeMissingAudio).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Made 22 so far, 28 to go')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make missing audio' })).toBeEnabled();
  });

  it('says the same when the action itself throws', async () => {
    makeMissingAudio.mockRejectedValueOnce(new Error('network'));
    render(<MissingAudioCard initialRemaining={5} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make missing audio' })); });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('5 sentences have no audio yet')).toBeInTheDocument();
  });

  it('says "1 sentence has" for one', () => {
    render(<MissingAudioCard initialRemaining={1} />);
    expect(screen.getByText('1 sentence has no audio yet')).toBeInTheDocument();
  });
});
