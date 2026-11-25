import { describe, it, expect } from 'vitest';
import { JoinBody } from '@/lib/joinBody';

describe('JoinBody', () => {
  it('accepts a non-RFC hex uuid', () => {
    expect(JoinBody.safeParse({ code: 'ABC234', studentId: '3f2b8c1e-0000-0000-0000-000000000001' }).success).toBe(true);
  });
  it('rejects a non-uuid studentId', () => {
    expect(JoinBody.safeParse({ code: 'ABC234', studentId: 'nope' }).success).toBe(false);
  });
});
