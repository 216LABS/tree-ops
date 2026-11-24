import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { fail } from '@/lib/http';

const body = z.object({ status: z.enum(['open', 'closed']), description: z.string().trim().min(3).max(4000).optional() });

export const PATCH = officeWrite<'id', typeof body>('claims.update', MANAGERS, body, async (tx, _ctx, b, { id }) => {
  const [c] = await tx`update claims set status = ${b.status}, description = coalesce(${b.description ?? null}, description) where id = ${id} returning id`;
  if (!c) fail('not_found', 'Claim not found.');
  return { ok: true };
});
