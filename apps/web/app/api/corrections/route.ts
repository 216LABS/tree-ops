import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { fail } from '@/lib/http';

const TABLES = ['work_log', 'tree_confirmations', 'briefings', 'briefing_signoffs', 'disposal_tickets', 'photos', 'phc_applications'] as const;
const body = z.object({ targetTable: z.enum(TABLES), targetId: z.uuid(), field: z.string().min(1).max(60), newValue: z.unknown(), reason: z.string().trim().min(3).max(600) });

/** Field records never change; a correction is a new row naming the record, the field, the new value and why. */
export const POST = officeWrite('corrections.create', MANAGERS, body, async (tx, ctx, b) => {
  const [exists] = await tx.unsafe(`select 1 from ${b.targetTable} where id = $1`, [b.targetId]);
  if (!exists) fail('not_found', 'That record wasn’t found.');
  const [c] = await tx`insert into corrections (tenant_id, target_table, target_id, field, new_value, reason, by_user) values (${ctx.tenantId}, ${b.targetTable}, ${b.targetId}, ${b.field}, ${tx.json((b.newValue ?? null) as never)}, ${b.reason}, ${ctx.userId}) returning id`;
  return { id: c!.id };
});
