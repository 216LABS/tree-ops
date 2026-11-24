import { mockStripeSignature } from '@treeops/providers';
import { z } from 'zod';
import { handlePaymentEvent } from '@/lib/billing';
import { isMock, isProd } from '@/lib/env';
import { fail, parseJson, route } from '@/lib/http';
import { providers } from '@/lib/providers';

/** Mock checkout's "Pay": builds a signed fake webhook and runs it through the same verification as live. */
export const POST = route(async (req) => {
  if (isProd() || !isMock()) fail('not_found', 'Not found.');
  const b = await parseJson(req, z.object({ sessionId: z.string().min(5).max(80), amount: z.number().int().positive(), meta: z.record(z.string(), z.string()) }));
  const raw = JSON.stringify({ id: `evt_mock_${b.sessionId}`, type: 'checkout.session.completed', data: { object: { id: b.sessionId, amount_total: b.amount, metadata: b.meta, payment_method_types: ['card'] } } });
  const ev = providers().payments.verifyWebhook(raw, mockStripeSignature(raw));
  return handlePaymentEvent(ev);
});
