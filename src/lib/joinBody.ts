import { z } from 'zod';
import { UUID_RE } from './uuid';

export const JoinBody = z.object({
  code: z.string().trim().min(1).max(12),
  studentId: z.string().regex(UUID_RE).optional(),
});
