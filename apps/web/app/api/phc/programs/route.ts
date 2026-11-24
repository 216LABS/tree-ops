import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';

const body = z.object({ propertyId: z.uuid(), year: z.number().int().min(2020).max(2100), status: z.enum(['proposed', 'active', 'done']).default('active'), notes: z.string().max(2000).nullish() });

export const POST = officeWrite('phc.program', SELLERS, body, async (tx, ctx, b) => {
  const [r] = await tx`insert into phc_programs (tenant_id, property_id, year, status, notes) values (${ctx.tenantId}, ${b.propertyId}, ${b.year}, ${b.status}, ${b.notes ?? null}) returning id`;
  return { id: r!.id };
});
