import { db } from '@treeops/db';
import { baseUrl } from '@/lib/env';
import { recordConsent } from '@/lib/messaging';
import { providers } from '@/lib/providers';

const STOP = /^(stop|stopall|unsubscribe|cancel|end|quit|parar|alto)$/i;
const START = /^(start|unstop|yes)$/i;
const HELP = /^(help|info|ayuda)$/i;

/**
 * Inbound texts: STOP, START and HELP (docs/SPEC.md section 14). The reply goes back as TwiML. A STOP is recorded for every
 * company that has texted this number, since the shared pilot number is one sender.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') params[k] = v;
  if (!providers().sms.verifyWebhook(`${baseUrl()}/api/webhooks/twilio`, params, req.headers.get('x-twilio-signature'))) return new Response('Bad signature', { status: 403 });
  const body = (params.Body ?? '').trim();
  const from = params.From ?? '';
  const tenants = await db()`select distinct tenant_id from messages where to_phone = ${from}`;
  let reply = '';
  if (STOP.test(body)) {
    for (const t of tenants) await recordConsent(db(), t.tenant_id, from, 'opted_out', 'sms:STOP');
    reply = 'You’re unsubscribed and won’t get more texts. Reply START to resubscribe.';
  } else if (START.test(body)) {
    for (const t of tenants) await recordConsent(db(), t.tenant_id, from, 'opted_in', 'sms:START');
    reply = 'You’re subscribed again to job texts. Reply STOP to opt out.';
  } else if (HELP.test(body)) {
    reply = 'Job texts from your tree service, sent with Tree Ops. Reply STOP to opt out. Msg & data rates may apply.';
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${reply ? `<Message>${reply.replace(/[<&>]/g, '')}</Message>` : ''}</Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}
