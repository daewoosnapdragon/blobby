import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountView } from '@/app/teacher/account/AccountView';
import { TeacherShell } from '@/app/teacher/views';

const noop = async () => {};
const actions = { saveName: noop, savePassword: noop };

describe('AccountView', () => {
  it('shows the email as text and a prefilled name field', () => {
    render(<AccountView email="kyla@example.com" name="Kyla" {...actions} />);
    expect(screen.getByText(/kyla@example.com/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('kyla@example.com')).toBeNull();
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toBe('Kyla');
    expect(name.maxLength).toBe(60);
  });

  it('has two new-password fields and both save buttons', () => {
    render(<AccountView email="kyla@example.com" name={null} {...actions} />);
    for (const label of ['New password', 'Type it again']) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input.autocomplete).toBe('new-password');
      expect(input.minLength).toBe(8);
    }
    expect(screen.getByRole('button', { name: 'Save name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save password' })).toBeInTheDocument();
  });

  it.each([
    ['name', 'Name saved.'],
    ['password', 'Password saved. Use it next time you sign in.'],
  ])('saved=%s shows "%s"', (saved, text) => {
    render(<AccountView email="kyla@example.com" name="Kyla" saved={saved} {...actions} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it.each([
    ['name', 'Enter a name from 1 to 60 characters.'],
    ['short', 'Use at least 8 characters.'],
    ['mismatch', "The two passwords don't match."],
    ['reauth', 'For safety, sign in again with an email link, then set your password.'],
    ['weak', 'That password is too easy to guess. Try a longer one.'],
    ['same', "That's already your password."],
    ['failed', "That didn't save. Try again."],
  ])('error=%s shows "%s"', (error, text) => {
    render(<AccountView email="kyla@example.com" name="Kyla" error={error} {...actions} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });

  it('shows nothing for an unknown error value', () => {
    render(<AccountView email="kyla@example.com" name="Kyla" error="<script>" {...actions} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('TeacherShell greeting', () => {
  it('greets by name and links to Account', () => {
    render(<TeacherShell signOut={noop} who="Kyla">x</TeacherShell>);
    expect(screen.getByText('Hi, Kyla')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/teacher/account');
  });

  it('marks Account as the current page', () => {
    render(<TeacherShell signOut={noop} who="Kyla" current="account">x</TeacherShell>);
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('aria-current', 'page');
  });

  it('has no greeting without who', () => {
    render(<TeacherShell signOut={noop}>x</TeacherShell>);
    expect(screen.queryByText(/Hi,/)).toBeNull();
  });
});
