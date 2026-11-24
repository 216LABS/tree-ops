import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';

const body = z.object({ name: z.string().trim().min(1).max(120), startedOn: z.iso.date() });

export const POST = officeWrite('storm.create', MANAGERS, body, async (tx, ctx, b) => {
  const [s] = await tx`insert into storm_events (tenant_id, branch_id, name, started_on) values (${ctx.tenantId}, ${ctx.branchId}, ${b.name}, ${b.startedOn}) returning id`;
  return { id: s!.id };
});
