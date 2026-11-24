import { asService, db, type Tx } from '@treeops/db';
import { estimateVsActual } from '@treeops/core/actual';
import { paymentFee } from '@treeops/core/fees';
import { billingFlags, invoiceFromJob, type ChangeOrderIn } from '@treeops/core/invoice';
import { dollars } from '@treeops/core/money';
import type { WebhookEvent } from '@treeops/providers';
import type { Ctx } from './auth';
import { baseUrl } from './env';
import { fail } from './http';
import { recordConsent, sendText, smsHref } from './messaging';
import { loadOptions } from './estimates';
import { saveSignature } from './photos';
import { providers } from './providers';
import { hashToken, newToken } from './tokens';

/** Everything the invoice and flags are computed from. Works on any connection; the caller scopes the tenant. */
export async function jobMoney(tx: Tx, tenantId: string, jobId: string) {
  const [job] = await tx`select j.*, e.id as estimate_id from jobs j join estimates e on e.id = j.estimate_id where j.id = ${jobId} and j.tenant_id = ${tenantId}`;
  if (!job) fail('not_found', 'Job not found.');
  const options = await loadOptions(tx, job!.estimate_id);
  const changeOrders = (await tx`select id, description, amount_cents, status from change_orders where job_id = ${jobId} and tenant_id = ${tenantId} order by created_at`) as unknown as ChangeOrderIn[];
  const [dep] = await tx`select coalesce(sum(p.amount_cents), 0)::int as paid from payments p join deposits d on d.id = p.deposit_id where d.estimate_id = ${job!.estimate_id} and p.tenant_id = ${tenantId}`;
  const confirmations = await tx`select line_id, result, after_photo_id, at from tree_confirmations where tenant_id = ${tenantId} and job_day_id in (select id from job_days where job_id = ${jobId})`;
  const events = await tx`select worker_id, kind, at, value, equipment_id from work_log where tenant_id = ${tenantId} and job_day_id in (select id from job_days where job_id = ${jobId})`;
  const variance = estimateVsActual(options.filter((o) => o.required || o.selected).flatMap((o) => o.lines), events as never);
  return { job: job!, options, changeOrders, depositsPaidCents: dep!.paid as number, confirmations: confirmations as unknown as never[], variance };
}

/**
 * Close and bill (docs/SPEC.md screen 8): the invoice from the signed estimate plus signed change orders, less deposits,
 * with flags for the office. Closing again while the invoice is a draft rebuilds it.
 */
export async function closeJob(tx: Tx, ctx: Ctx, jobId: string) {
  const m = await jobMoney(tx, ctx.tenantId, jobId);
  if (m.job.status === 'cancelled') fail('conflict', 'This job was cancelled.');
  const [existing] = await tx`select id, status from invoices where job_id = ${jobId}`;
  if (existing && existing.status !== 'draft') fail('conflict', `The invoice was already ${existing.status}.`);
  const inv = invoiceFromJob({ options: m.options, minJobCents: ctx.settings.min_job_cents, changeOrders: m.changeOrders, depositsPaidCents: m.depositsPaidCents });
  const flags = billingFlags({ options: m.options, confirmations: m.confirmations, estHours: m.variance.estHours, actualHours: m.variance.actualHours, changeOrders: m.changeOrders });
  let invoiceId = existing?.id as string | undefined;
  const due = new Date(Date.now() + 86_400_000 * Number((await tx`select c.billing_terms_days from customers c join properties p on p.customer_id = c.id where p.id = ${m.job.property_id}`)[0]?.billing_terms_days ?? 0)).toISOString().slice(0, 10);
  if (!invoiceId) {
    const [n] = await tx`select app.next_number(${ctx.tenantId}, 'invoice') as n`;
    const [row] = await tx`insert into invoices (tenant_id, job_id, number, subtotal_cents, deposit_applied_cents, total_cents, flags, due_date)
      values (${ctx.tenantId}, ${jobId}, ${String(n!.n)}, ${inv.subtotalCents}, ${inv.depositAppliedCents}, ${inv.totalCents}, ${tx.json(flags as never)}, ${due}) returning id`;
    invoiceId = row!.id;
  } else {
    await tx`update invoices set subtotal_cents = ${inv.subtotalCents}, deposit_applied_cents = ${inv.depositAppliedCents}, total_cents = ${inv.totalCents}, flags = ${tx.json(flags as never)}, flags_ack_at = null, flags_ack_by = null, due_date = ${due} where id = ${invoiceId}`;
    await tx`delete from invoice_lines where invoice_id = ${invoiceId}`;
  }
  let sort = 0;
  for (const l of inv.lines) await tx`insert into invoice_lines (tenant_id, invoice_id, source, source_id, description, amount_cents, sort) values (${ctx.tenantId}, ${invoiceId!}, ${l.source}, ${l.source_id}, ${l.description}, ${l.amount_cents}, ${sort++})`;
  await tx`update jobs set status = 'done', closed_at = coalesce(closed_at, now()) where id = ${jobId}`;
  await tx`update job_days set status = 'closed' where job_id = ${jobId} and status <> 'closed'`;
  return { invoiceId: invoiceId!, flags, totalCents: inv.totalCents, variance: m.variance };
}

export async function ackFlags(tx: Tx, ctx: Ctx, invoiceId: string) {
  const [r] = await tx`update invoices set flags_ack_at = now(), flags_ack_by = ${ctx.userId} where id = ${invoiceId} and status = 'draft' returning id`;
  if (!r) fail('conflict', 'Only a draft invoice can be reviewed.');
}

/** Sends the invoice by text. Flags must be looked at first (screen 8, AC). */
export async function sendInvoice(tx: Tx, ctx: Ctx, invoiceId: string) {
  const [inv] = await tx`select i.*, c.phone, c.locale, c.id as customer_id from invoices i join jobs j on j.id = i.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id where i.id = ${invoiceId}`;
  if (!inv) fail('not_found', 'Invoice not found.');
  if (inv!.status === 'void') fail('conflict', 'This invoice is void.');
  if ((inv!.flags as unknown[]).length && !inv!.flags_ack_at) fail('validation', 'Look over the flags and mark them reviewed before sending.');
  const token = newToken();
  await tx`update invoices set status = case when status = 'draft' then 'sent' else status end, sent_at = coalesce(sent_at, now()), public_token_hash = ${hashToken(token)} where id = ${invoiceId}`;
  if (inv!.total_cents === 0) await tx`update invoices set status = 'paid', paid_at = now() where id = ${invoiceId}`;
  const link = `${baseUrl()}/i/${token}`;
  const text = await sendText({ tenantId: ctx.tenantId, to: inv!.phone, template: 'invoice', locale: inv!.locale, vars: { amount: dollars(inv!.total_cents), link }, customerId: inv!.customer_id, related: { type: 'invoice', id: invoiceId }, idemKey: `invoice:${invoiceId}:${token.slice(0, 8)}` });
  return { publicUrl: link, text: text.status, smsHref: ['blocked_no_consent', 'no_phone'].includes(text.status) ? smsHref(inv!.phone, text.body) : null };
}

/** A hosted payment page for a deposit or an invoice, on the company's Stripe account, with the platform fee. */
export async function checkout(kind: 'deposit' | 'invoice', token: string) {
  const sql = db();
  const row =
    kind === 'deposit'
      ? (await sql`select d.id, d.tenant_id, d.amount_cents as amount, d.status, e.number, t.name as company, t.plan, t.stripe_account_id from deposits d join estimates e on e.id = d.estimate_id join tenants t on t.id = d.tenant_id where e.public_token_hash = ${hashToken(token)}`)[0]
      : (await sql`select i.id, i.tenant_id, i.total_cents as amount, i.status, i.number, t.name as company, t.plan, t.stripe_account_id from invoices i join tenants t on t.id = i.tenant_id where i.public_token_hash = ${hashToken(token)}`)[0];
  if (!row) fail('not_found', 'This payment link isn’t valid.');
  if (['paid'].includes(row!.status)) fail('conflict', 'This is already paid. Thank you.');
  if (row!.status === 'void') fail('conflict', 'This invoice was cancelled.');
  if (!row!.stripe_account_id) fail('not_configured', 'This company hasn’t turned on card payments yet. Call them to pay.');
  const p = providers().payments;
  const fee = paymentFee(row!.amount, row!.plan);
  const back = `${baseUrl()}/${kind === 'deposit' ? 'e' : 'i'}/${token}`;
  const s = await p.createCheckout(row!.stripe_account_id, {
    amountCents: row!.amount, feeCents: fee, description: `${row!.company} ${kind === 'deposit' ? `deposit, estimate ${row!.number}` : `invoice ${row!.number}`}`,
    successUrl: `${back}?paid=1`, cancelUrl: back, metadata: { tenant_id: row!.tenant_id, kind, id: row!.id, fee_cents: String(fee) }, idempotencyKey: `checkout:${kind}:${row!.id}:${row!.amount}`,
  });
  if (kind === 'deposit') await sql`update deposits set checkout_id = ${s.id} where id = ${row!.id} and tenant_id = ${row!.tenant_id}`;
  else await sql`update invoices set checkout_id = ${s.id} where id = ${row!.id} and tenant_id = ${row!.tenant_id}`;
  return { url: s.url };
}

/** Stripe webhook: once per event id, and once per checkout session (payments.stripe_ref is unique). */
export async function handlePaymentEvent(ev: WebhookEvent) {
  const sql = db();
  const [first] = await sql`insert into stripe_events (id, type) values (${ev.id}, ${ev.type}) on conflict do nothing returning id`;
  if (!first) return { duplicate: true };
  if (ev.type === 'account.updated' && ev.account) {
    await sql`update tenants set stripe_charges_enabled = ${Boolean(ev.data.object.charges_enabled)} where stripe_account_id = ${ev.account}`;
    return { ok: true };
  }
  if (ev.type !== 'checkout.session.completed') return { ignored: true };
  const s = ev.data.object;
  const meta = (s.metadata ?? {}) as { tenant_id?: string; kind?: string; id?: string; fee_cents?: string };
  if (!meta.tenant_id || !meta.id || !meta.kind) return { ignored: true };
  const amount = Number(s.amount_total);
  const method = (s.payment_method_types?.[0] as string | undefined) === 'us_bank_account' ? 'ach' : 'card';
  let notify: { phone: string; locale: 'en' | 'es'; customerId: string } | null = null;
  await asService(async (tx) => {
    const inserted = await tx`insert into payments (tenant_id, invoice_id, deposit_id, amount_cents, fee_cents, method, stripe_ref, received_at)
      values (${meta.tenant_id!}, ${meta.kind === 'invoice' ? meta.id! : null}, ${meta.kind === 'deposit' ? meta.id! : null}, ${amount}, ${Number(meta.fee_cents ?? 0)}, ${method}, ${s.id}, now())
      on conflict (stripe_ref) do nothing returning id`;
    if (!inserted.length) return;
    if (meta.kind === 'deposit') {
      await tx`update deposits set status = 'paid' where id = ${meta.id!} and tenant_id = ${meta.tenant_id!}`;
      const [c] = await tx`select c.id, c.phone, c.locale from deposits d join estimates e on e.id = d.estimate_id join properties p on p.id = e.property_id join customers c on c.id = p.customer_id where d.id = ${meta.id!}`;
      if (c?.phone) notify = { phone: c.phone, locale: c.locale, customerId: c.id };
    } else {
      const [inv] = await tx`select total_cents, job_id from invoices where id = ${meta.id!} and tenant_id = ${meta.tenant_id!}`;
      const [paid] = await tx`select coalesce(sum(amount_cents), 0)::int as n from payments where invoice_id = ${meta.id!}`;
      if (inv && paid!.n >= inv.total_cents) {
        await tx`update invoices set status = 'paid', paid_at = now() where id = ${meta.id!}`;
        await tx`update jobs set status = 'billed' where id = ${inv.job_id}`;
      }
    }
  });
  if (notify) {
    const n = notify as { phone: string; locale: 'en' | 'es'; customerId: string };
    await sendText({ tenantId: meta.tenant_id, to: n.phone, template: 'deposit_received', locale: n.locale, vars: { amount: dollars(amount) }, customerId: n.customerId, related: { type: 'deposit', id: meta.id }, idemKey: `deposit_received:${meta.id}` }).catch(() => null);
  }
  return { ok: true };
}

/** A check, cash or insurer payment the office records by hand. Payments are server-written, so roles are checked here. */
export async function recordManualPayment(ctx: Ctx, invoiceId: string, b: { amountCents: number; method: 'check' | 'cash' | 'insurer'; reference?: string | null }) {
  if (!['owner', 'office'].includes(ctx.role)) fail('forbidden', 'Only owner or office can record payments.');
  return asService(async (tx) => {
    const [inv] = await tx`select id, total_cents, job_id, status from invoices where id = ${invoiceId} and tenant_id = ${ctx.tenantId}`;
    if (!inv) fail('not_found', 'Invoice not found.');
    if (inv!.status === 'void') fail('conflict', 'This invoice is void.');
    await tx`insert into payments (tenant_id, invoice_id, amount_cents, method, stripe_ref, received_at) values (${ctx.tenantId}, ${invoiceId}, ${b.amountCents}, ${b.method}, ${b.reference ? `manual:${invoiceId}:${b.reference}` : null}, now())`;
    const [paid] = await tx`select coalesce(sum(amount_cents), 0)::int as n from payments where invoice_id = ${invoiceId}`;
    if (paid!.n >= inv!.total_cents) {
      await tx`update invoices set status = 'paid', paid_at = now() where id = ${invoiceId}`;
      await tx`update jobs set status = 'billed' where id = ${inv!.job_id}`;
    }
    await tx`insert into audit_log (tenant_id, actor_id, action, target_table, target_id, after) values (${ctx.tenantId}, ${ctx.userId}, 'payment', 'invoices', ${invoiceId}, ${tx.json(b as never)})`;
    return { paidCents: paid!.n as number };
  });
}

/** Office sends a proposed change order to the customer to sign on their own phone. */
export async function sendChangeOrder(tx: Tx, ctx: Ctx, id: string) {
  const [co] = await tx`select co.*, c.phone, c.locale, c.id as customer_id from change_orders co join jobs j on j.id = co.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id where co.id = ${id}`;
  if (!co) fail('not_found', 'Change order not found.');
  if (co!.status !== 'proposed') fail('conflict', `This change order is ${co!.status}.`);
  const token = newToken();
  await tx`update change_orders set public_token_hash = ${hashToken(token)} where id = ${id}`;
  const link = `${baseUrl()}/co/${token}`;
  const text = await sendText({ tenantId: ctx.tenantId, to: co!.phone, template: 'change_order', locale: co!.locale, vars: { amount: dollars(co!.amount_cents), link }, customerId: co!.customer_id, related: { type: 'change_order', id }, idemKey: `co:${id}:${token.slice(0, 8)}` });
  return { publicUrl: link, text: text.status, smsHref: ['blocked_no_consent', 'no_phone'].includes(text.status) ? smsHref(co!.phone, text.body) : null };
}

export async function changeOrderByToken(token: string) {
  const [co] = await db()`select co.*, t.name as company, c.name as customer_name, c.locale, p.address, j.number as job_number from change_orders co join tenants t on t.id = co.tenant_id join jobs j on j.id = co.job_id
    join properties p on p.id = j.property_id join customers c on c.id = p.customer_id where co.public_token_hash = ${hashToken(token)}`;
  return co ?? null;
}

export async function signChangeOrder(token: string, b: { signerName: string; signaturePng: string; clientId: string; decline?: boolean; consentSms?: boolean }, meta: { ip: string | null; userAgent: string | null }) {
  const co = await changeOrderByToken(token);
  if (!co) fail('not_found', 'This link isn’t valid.');
  if (co!.status === 'signed') return { status: 'signed' };
  if (co!.status !== 'proposed') fail('conflict', `This change order is ${co!.status}.`);
  return asService(async (tx) => {
    if (b.decline) {
      await tx`update change_orders set status = 'declined' where id = ${co!.id} and tenant_id = ${co!.tenant_id}`;
      return { status: 'declined' };
    }
    const sig = await saveSignature(tx, { tenantId: co!.tenant_id, subjectType: 'change_order', subjectId: co!.id, signerName: b.signerName, signerRole: 'customer', png: b.signaturePng, signedAt: new Date(), ip: meta.ip, userAgent: meta.userAgent, clientId: b.clientId });
    await tx`update change_orders set status = 'signed', signature_id = ${sig} where id = ${co!.id} and tenant_id = ${co!.tenant_id}`;
    if (b.consentSms) {
      const [c] = await tx`select c.phone from jobs j join properties p on p.id = j.property_id join customers c on c.id = p.customer_id where j.id = ${co!.job_id}`;
      if (c?.phone) await recordConsent(tx, co!.tenant_id, c.phone, 'opted_in', 'change_order_checkbox');
    }
    return { status: 'signed' };
  });
}

export async function invoiceByToken(token: string) {
  const sql = db();
  const [inv] = await sql`select i.*, t.name as company, t.phone as company_phone, t.stripe_account_id, c.name as customer_name, c.locale, p.address, j.number as job_number
    from invoices i join tenants t on t.id = i.tenant_id join jobs j on j.id = i.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id
    where i.public_token_hash = ${hashToken(token)}`;
  if (!inv) return null;
  const lines = await sql`select description, amount_cents from invoice_lines where invoice_id = ${inv.id} and tenant_id = ${inv.tenant_id} order by sort`;
  return { ...inv, lines } as Record<string, any>;
}
