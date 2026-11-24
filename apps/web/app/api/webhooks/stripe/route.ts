import { handlePaymentEvent } from '@/lib/billing';
import { fail, route } from '@/lib/http';
import { providers } from '@/lib/providers';

/** Verified on the raw body; idempotent on the event id and on the checkout session. */
export const POST = route(async (req) => {
  const raw = await req.text();
  let ev;
  try {
    ev = providers().payments.verifyWebhook(raw, req.headers.get('stripe-signature'));
  } catch {
    fail('validation', 'Bad signature.');
  }
  return handlePaymentEvent(ev!);
});
