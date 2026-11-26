import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuestionPicture } from '@/components/questions/QuestionPicture';
import { PicturePicker } from '@/app/teacher/editor/PicturePicker';
import { QuestionAnswers } from '@/app/teacher/editor/QuestionAnswers';
import type { PictureEntry } from '@/lib/pictures';

const CATALOG: PictureEntry[] = [
  { n: 'elephant', l: 'elephant', k: ['animal'] },
  { n: 'taxi', l: 'taxi', k: ['car', 'vehicle'] },
  { n: 'automobile', l: 'automobile', k: ['car'] },
  { n: 'red-apple', l: 'red apple', k: ['apple', 'fruit'] },
];

describe('QuestionPicture (kid screen)', () => {
  it('shows the picture file, as decoration', () => {
    const { container } = render(<QuestionPicture name="elephant" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/pictures/elephant.svg');
    expect(img.getAttribute('alt')).toBe('');
  });
  it('shows nothing without a picture', () => {
    const { container } = render(<QuestionPicture name={undefined} />);
    expect(container.querySelector('img')).toBeNull();
  });
  it('hides itself when the file is missing, so no broken image shows', () => {
    const { container } = render(<QuestionPicture name="no-such-picture" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('PicturePicker (editor)', () => {
  it('suggests pictures from the question words and picks one', () => {
    const onChange = vi.fn();
    render(<PicturePicker text="Ben drew an elephant today." value="" onChange={onChange} catalog={CATALOG} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use the elephant picture' }));
    expect(onChange).toHaveBeenCalledWith('elephant');
  });
  it('searches by keyword', () => {
    const onChange = vi.fn();
    render(<PicturePicker text="" value="" onChange={onChange} catalog={CATALOG} />);
    fireEvent.change(screen.getByLabelText('Search pictures'), { target: { value: 'car' } });
    expect(screen.getByRole('button', { name: 'Use the automobile picture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use the taxi picture' })).toBeInTheDocument();
  });
  it('shows the chosen picture with Remove', () => {
    const onChange = vi.fn();
    render(<PicturePicker text="" value="red-apple" onChange={onChange} catalog={CATALOG} />);
    expect(screen.getByText('red apple')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
  it('says so when a search finds nothing', () => {
    render(<PicturePicker text="" value="" onChange={vi.fn()} catalog={CATALOG} />);
    fireEvent.change(screen.getByLabelText('Search pictures'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No pictures for/)).toBeInTheDocument();
  });
});

describe('QuestionAnswers shows the picture', () => {
  it('includes a small picture when the question has one', () => {
    const { container } = render(<QuestionAnswers question={{ type: 'pick_one', prompt: 'Pick.', choices: ['an egg', 'a egg'], answer: 0, picture: 'egg' }} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/pictures/egg.svg');
  });
});
