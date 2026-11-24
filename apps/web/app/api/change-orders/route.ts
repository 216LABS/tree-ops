import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';

const body = z.object({ jobId: z.uuid(), description: z.string().trim().min(1).max(500), amountCents: z.number().int().min(0).max(100_000_000), clientId: z.uuid() });

/** The office writes up extra work; it reaches a bill only after the customer signs (docs/DECISIONS.md D-9). */
export const POST = officeWrite('change-orders.create', SELLERS, body, async (tx, ctx, b) => {
  const [co] = await tx`insert into change_orders (tenant_id, job_id, description, amount_cents, client_id) values (${ctx.tenantId}, ${b.jobId}, ${b.description}, ${b.amountCents}, ${b.clientId})
    on conflict (client_id) do update set description = change_orders.description returning id`;
  return { id: co!.id };
});
