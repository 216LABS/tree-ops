import { toE164 } from '@treeops/core/messages';
import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';

const body = z.object({
  callerName: z.string().max(120).nullish(),
  phone: z.string().max(30).nullish(),
  address: z.string().trim().min(3).max(300),
  onStructure: z.boolean().default(false),
  blockingAccess: z.boolean().default(false),
  linesInvolved: z.boolean().default(false),
  injury: z.boolean().default(false),
  insurer: z.string().max(120).nullish(),
  notes: z.string().max(2000).nullish(),
});

/** A storm call, taken in under a minute (screen 10). Calls with wires down start in the "utility" lane. */
export const POST = officeWrite<'id', typeof body>('storm.intake', SELLERS, body, async (tx, ctx, b, { id }) => {
  const [r] = await tx`insert into storm_intake (tenant_id, storm_event_id, caller_name, phone, address, on_structure, blocking_access, lines_involved, injury, insurer, notes, status)
    values (${ctx.tenantId}, ${id}, ${b.callerName ?? null}, ${b.phone ? (toE164(b.phone) ?? b.phone) : null}, ${b.address}, ${b.onStructure}, ${b.blockingAccess}, ${b.linesInvolved}, ${b.injury}, ${b.insurer ?? null}, ${b.notes ?? null},
      ${b.linesInvolved ? 'utility' : 'new'}) returning id`;
  return { id: r!.id };
});
