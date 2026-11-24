import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { fail } from '@/lib/http';
import { recordConsent } from '@/lib/messaging';

const body = z.object({ phone: z.string().min(7).max(30), status: z.enum(['opted_in', 'opted_out']), note: z.string().max(200).nullish() });

/** The office logs a customer's spoken OK to texts (or a request to stop), with who logged it (docs/SPEC.md section 13). */
export const POST = officeWrite('consents.log', SELLERS, body, async (tx, ctx, b) => {
  const ok = await recordConsent(tx, ctx.tenantId, b.phone, b.status, `verbal:office:${ctx.userId}${b.note ? `:${b.note}` : ''}`);
  if (!ok) fail('validation', 'That isn’t a US mobile number.');
  return { ok: true };
});
