import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { derivedToken, hashToken } from '@/lib/tokens';

const body = z.object({ jobId: z.uuid().nullish(), openedOn: z.iso.date(), kind: z.enum(['property_damage', 'injury', 'vehicle', 'other']), description: z.string().trim().min(3).max(4000) });

export const POST = officeWrite('claims.create', MANAGERS, body, async (tx, ctx, b) => {
  const id = crypto.randomUUID();
  await tx`insert into claims (id, tenant_id, job_id, opened_on, kind, description, viewer_token_hash) values (${id}, ${ctx.tenantId}, ${b.jobId ?? null}, ${b.openedOn}, ${b.kind}, ${b.description}, ${hashToken(derivedToken('claim', id))})`;
  return { id };
});
