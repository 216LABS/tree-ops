import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { overrideCheck } from '@/lib/jobs';

const body = z.object({ reason: z.string().trim().min(10, 'Say why in at least 10 characters.').max(600) });

/** Owner or office only; the database enforces it too, and the audit log keeps who and why. */
export const POST = officeWrite<'id', typeof body>('prework.override', MANAGERS, body, async (tx, _ctx, b, { id }) => {
  await overrideCheck(tx, id, b.reason);
  return { ok: true };
});
