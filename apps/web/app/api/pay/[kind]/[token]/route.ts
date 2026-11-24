import type { P } from '@/lib/api';
import { checkout } from '@/lib/billing';
import { clientIp, fail, rateLimit, route } from '@/lib/http';

/** Card or bank payment for a deposit or an invoice, on the company's Stripe account. */
export const POST = route<P<'kind' | 'token'>>(async (req, { params }) => {
  const { kind, token } = await params;
  rateLimit(`pay:${clientIp(req)}`, 30);
  if (kind !== 'deposit' && kind !== 'invoice') fail('not_found', 'Not found.');
  return checkout(kind as 'deposit' | 'invoice', token);
});
