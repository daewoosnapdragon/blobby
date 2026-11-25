import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { PickBlob } from '@/app/(kid)/pick/PickBlob';
import { koPick } from '@/lib/copy.ko';

describe('pick your blob (first screen after a QR scan)', () => {
  it('has one short Korean line for the parent (spec 5.1)', () => {
    render(<PickBlob name="Mina" initial="sunny" />);
    const ko = document.querySelectorAll('[lang="ko"]');
    expect(ko).toHaveLength(1);
    expect(ko[0].textContent).toBe(koPick.parentNote);
  });
});
