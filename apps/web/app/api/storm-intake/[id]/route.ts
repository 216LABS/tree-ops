import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { createEstimate } from '@/lib/estimates';
import { fail } from '@/lib/http';

const body = z.object({ status: z.enum(['new', 'assessed', 'estimated', 'scheduled', 'done', 'declined', 'utility']).optional(), convert: z.boolean().default(false), stateCode: z.string().length(2).optional() });

/**
 * Update a storm call, or turn it into a customer, property and draft estimate in one step ("convert"), so the sales
 * arborist can go straight to pinning trees.
 */
export const PATCH = officeWrite<'id', typeof body>('storm.intake.update', SELLERS, body, async (tx, ctx, b, { id }) => {
  const [i] = await tx`select * from storm_intake where id = ${id}`;
  if (!i) fail('not_found', 'Call not found.');
  if (b.convert) {
    if (i!.property_id) {
      const [e] = await tx`select id from estimates where property_id = ${i!.property_id} order by created_at desc limit 1`;
      return { propertyId: i!.property_id, estimateId: e?.id ?? null };
    }
    const [c] = await tx`insert into customers (tenant_id, branch_id, name, phone, notes) values (${ctx.tenantId}, ${ctx.branchId}, ${i!.caller_name || 'Storm caller'}, ${i!.phone}, ${i!.insurer ? `Insurer: ${i!.insurer}` : null}) returning id`;
    const hazards = [i!.on_structure && 'Tree on a structure', i!.lines_involved && 'Wires involved', i!.blocking_access && 'Blocking access'].filter(Boolean);
    const [p] = await tx`insert into properties (tenant_id, customer_id, address, state_code, hazards, access_notes) values (${ctx.tenantId}, ${c!.id}, ${i!.address}, ${(b.stateCode ?? ctx.tenant.state_code).toUpperCase()}, ${tx.json(hazards as string[])}, ${i!.notes}) returning id`;
    const estimateId = await createEstimate(tx, ctx, p!.id);
    await tx`update storm_intake set property_id = ${p!.id}, status = 'estimated' where id = ${id}`;
    return { propertyId: p!.id, estimateId };
  }
  if (b.status) await tx`update storm_intake set status = ${b.status} where id = ${id}`;
  return { ok: true };
});
