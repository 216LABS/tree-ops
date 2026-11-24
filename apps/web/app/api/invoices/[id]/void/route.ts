import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { fail } from '@/lib/http';

export const POST = officeWrite<'id', never>('invoices.void', MANAGERS, null, async (tx, _ctx, _b, { id }) => {
  const [paid] = await tx`select count(*)::int as n from payments where invoice_id = ${id}`;
  if (paid!.n > 0) fail('conflict', 'Money was received on this invoice; refund it in Stripe first.');
  const [r] = await tx`update invoices set status = 'void' where id = ${id} and status in ('draft','sent') returning job_id`;
  if (!r) fail('conflict', 'This invoice can’t be voided.');
  await tx`update jobs set status = 'done' where id = ${r!.job_id}`;
  return { ok: true };
});
