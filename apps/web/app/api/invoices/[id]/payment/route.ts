import { z } from 'zod';
import type { P } from '@/lib/api';
import { MANAGERS, requireApi } from '@/lib/auth';
import { recordManualPayment } from '@/lib/billing';
import { idempotent, parseJson, route } from '@/lib/http';

const body = z.object({ amountCents: z.number().int().positive().max(100_000_000), method: z.enum(['check', 'cash', 'insurer']), reference: z.string().max(80).nullish() });

export const POST = route<P<'id'>>(async (req, { params }) => {
  const ctx = await requireApi(MANAGERS);
  const { id } = await params;
  const b = await parseJson(req, body);
  return idempotent(ctx.tenantId, req, 'invoices.payment', () => recordManualPayment(ctx, id, b));
});
