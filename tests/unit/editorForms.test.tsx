// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { TypeForm } from '@/app/teacher/editor/TypeForms';
import { draftToPayload, emptyDraft, type NonWatchDraft } from '@/lib/questions/draft';
import { parseQuestion } from '@/lib/questions/schema';

afterEach(cleanup);

function Harness({ start, onDraft }: { start: NonWatchDraft; onDraft: (d: NonWatchDraft) => void }) {
  const [d, setD] = useState(start);
  onDraft(d);
  return <TypeForm draft={d} onChange={setD} />;
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('the pick_one form', () => {
  it('fills in to a valid question; the radio marks the right choice', () => {
    let draft = emptyDraft('pick_one');
    render(<Harness start={draft} onDraft={(d) => { draft = d as typeof draft; }} />);
    type('Question', 'Which one is about yesterday?');
    type('Choice 1', 'I walk to school.');
    type('Choice 2', 'I walked to school.');
    fireEvent.click(screen.getByLabelText('Choice 2 is the right answer'));
    expect(parseQuestion('pick_one', draftToPayload(draft))).toEqual({
      type: 'pick_one', prompt: 'Which one is about yesterday?', choices: ['I walk to school.', 'I walked to school.'], answer: 1,
    });
  });

  it('adding and removing choices keeps the right answer on its row and stops at 4 and 2', () => {
    let draft: NonWatchDraft = { type: 'pick_one', prompt: 'Q', choices: ['a', 'b', 'c'], answer: 2 };
    render(<Harness start={draft} onDraft={(d) => { draft = d; }} />);
    fireEvent.click(screen.getByLabelText('Remove choice 1'));
    expect(draft).toMatchObject({ choices: ['b', 'c'], answer: 1 });
    expect((screen.getByLabelText('Remove choice 1') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('+ Add a choice'));
    fireEvent.click(screen.getByText('+ Add a choice'));
    expect((screen.getByText('+ Add a choice') as HTMLButtonElement).disabled).toBe(true);
    // removing the right answer's row clears the pick, which is then a readable problem on save
    fireEvent.click(screen.getByLabelText('Remove choice 2'));
    expect(draft).toMatchObject({ answer: -1 });
  });
});

describe('the find_fix form', () => {
  it('splits the sentence into pickable words and builds a valid question', () => {
    let draft = emptyDraft('find_fix');
    render(<Harness start={draft} onDraft={(d) => { draft = d as typeof draft; }} />);
    type('Sentence', 'She goed home.');
    fireEvent.click(screen.getByLabelText('goed'));
    type('Fix 1', 'go');
    type('Fix 2', 'went');
    fireEvent.click(screen.getByLabelText('Fix 2 is the right answer'));
    expect(parseQuestion('find_fix', draftToPayload(draft))).toEqual({
      type: 'find_fix', words: ['She', 'goed', 'home.'], wrongIndex: 1, fixes: ['go', 'went'], answer: 1,
    });
  });
});

describe('the sort_it form', () => {
  it('removing a group moves its words into the first group', () => {
    let draft: NonWatchDraft = { type: 'sort_it', prompt: 'Sort', groups: ['noun', 'verb', 'other'], items: [{ text: 'dog', group: 0 }, { text: 'run', group: 1 }, { text: 'red', group: 2 }] };
    render(<Harness start={draft} onDraft={(d) => { draft = d; }} />);
    fireEvent.click(screen.getByLabelText('Remove group 2'));
    expect(draft).toMatchObject({ groups: ['noun', 'other'], items: [{ group: 0 }, { group: 0 }, { group: 1 }] });
  });
});
