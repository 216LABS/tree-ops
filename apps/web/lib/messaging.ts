import { db, type Q } from '@treeops/db';
import { inQuietHours, nextSendTime, render, toE164, type Locale, type Template } from '@treeops/core/messages';
import { settingsOf } from '@treeops/core/settings';
import { providers } from './providers';
import { enqueue, runDue } from './queue';

/**
 * Texts only (docs/SPEC.md section 13; the same rule Sam set for Flake). A text goes out only when the latest consent
 * for that number is opted_in; otherwise it's recorded as blocked and the office shares the link from its own phone.
 */
export async function consentFor(sql: Q, tenantId: string, phone: string): Promise<'opted_in' | 'opted_out' | null> {
  const e164 = toE164(phone);
  if (!e164) return null;
  const [row] = await sql`select status from consents where tenant_id = ${tenantId} and phone = ${e164} order by at desc, created_at desc limit 1`;
  return (row?.status as 'opted_in' | 'opted_out' | undefined) ?? null;
}

export async function recordConsent(sql: Q, tenantId: string, phone: string, status: 'opted_in' | 'opted_out', source: string) {
  const e164 = toE164(phone);
  if (!e164) return false;
  await sql`insert into consents (tenant_id, phone, status, source) values (${tenantId}, ${e164}, ${status}, ${source})`;
  return true;
}

export interface TextInput {
  tenantId: string;
  to: string | null | undefined;
  template: Template;
  locale?: Locale;
  vars: Record<string, string>;
  customerId?: string | null;
  workerId?: string | null;
  related?: { type: string; id: string };
  /** Same key, same message: a repeat does nothing. */
  idemKey: string;
}

export type TextResult = { status: 'sent' | 'mock_sent' | 'queued' | 'held_quiet_hours' | 'blocked_no_consent' | 'no_phone' | 'duplicate' | 'failed'; body: string; messageId?: string };

export async function sendText(input: TextInput): Promise<TextResult> {
  const sql = db();
  const [tenant] = await sql`select name, timezone, settings, sms_sender from tenants where id = ${input.tenantId}`;
  const locale = input.locale ?? 'en';
  const body = render(input.template, locale, { company: tenant!.name, ...input.vars });
  const to = toE164(input.to);
  if (!to) return { status: 'no_phone', body };
  const consent = await consentFor(sql, input.tenantId, to);
  const quiet = inQuietHours(new Date(), tenant!.timezone, settingsOf(tenant!.settings));
  const status = consent !== 'opted_in' ? 'blocked_no_consent' : quiet ? 'held_quiet_hours' : 'queued';
  const [msg] = await sql`
    insert into messages (tenant_id, customer_id, worker_id, to_phone, template, locale, body, related_type, related_id, status, idem_key)
    values (${input.tenantId}, ${input.customerId ?? null}, ${input.workerId ?? null}, ${to}, ${input.template}, ${locale}, ${body},
      ${input.related?.type ?? null}, ${input.related?.id ?? null}, ${status}, ${input.idemKey})
    on conflict (tenant_id, idem_key) do nothing returning id`;
  if (!msg) return { status: 'duplicate', body };
  if (status === 'blocked_no_consent') return { status, body, messageId: msg.id };
  const runAfter = quiet ? nextSendTime(new Date(), tenant!.timezone, settingsOf(tenant!.settings)) : new Date();
  const jobId = await enqueue(sql, 'sms.send', { messageId: msg.id }, { tenantId: input.tenantId, runAfter, idemKey: `sms:${msg.id}` });
  if (quiet) return { status, body, messageId: msg.id };
  // Try right away; a failure stays queued for the cron worker to retry.
  if (jobId) await runDue(jobHandlersForSms, 1, [jobId]).catch(() => {});
  const [after] = await sql`select status from messages where id = ${msg.id}`;
  return { status: after!.status, body, messageId: msg.id };
}

/** The sms.send job: sends one recorded message if consent still holds. */
export async function deliverMessage(messageId: string) {
  const sql = db();
  const [m] = await sql`select m.*, t.sms_sender from messages m join tenants t on t.id = m.tenant_id where m.id = ${messageId}`;
  if (!m || ['sent', 'mock_sent', 'blocked_no_consent'].includes(m.status)) return;
  if ((await consentFor(sql, m.tenant_id, m.to_phone)) !== 'opted_in') {
    await sql`update messages set status = 'blocked_no_consent' where id = ${messageId}`;
    return;
  }
  try {
    const out = await providers().sms.send({ from: m.sms_sender, to: m.to_phone, body: m.body });
    await sql`update messages set status = ${providers().sms.mock ? 'mock_sent' : 'sent'}, provider_id = ${out.id}, error = null where id = ${messageId}`;
  } catch (err) {
    await sql`update messages set status = 'failed', error = ${err instanceof Error ? err.message.slice(0, 300) : 'failed'} where id = ${messageId}`;
    throw err;
  }
}

const jobHandlersForSms = {
  'sms.send': (p: { messageId: string }) => deliverMessage(p.messageId),
  'weather.refresh': async () => {},
  'estimate.expire': async () => {},
  'links.revoke': async () => {},
};

/** A link the office can open on its own phone to send the text itself (before the customer has opted in). */
export const smsHref = (phone: string | null | undefined, body: string) => {
  const to = toE164(phone);
  return to ? `sms:${to}?&body=${encodeURIComponent(body)}` : null;
};
