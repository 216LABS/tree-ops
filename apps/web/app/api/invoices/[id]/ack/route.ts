import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { ackFlags } from '@/lib/billing';

export const POST = officeWrite<'id', never>('invoices.ack', MANAGERS, null, async (tx, ctx, _b, { id }) => {
  await ackFlags(tx, ctx, id);
  return { ok: true };
});
