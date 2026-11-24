import { db, type Tx } from '@treeops/db';
import { phcRecord } from '@treeops/core/phc';
import { z } from 'zod';
import type { Ctx } from './auth';
import { baseUrl } from './env';
import { fail } from './http';
import { sendText, smsHref } from './messaging';
import { prettyDay } from './jobs';
import { derivedToken, hashToken } from './tokens';
import { localParts } from '@treeops/core/equipment';

export const phcBody = z.object({
  clientId: z.uuid(),
  programId: z.uuid().nullish(),
  propertyId: z.uuid(),
  applicatorWorkerId: z.uuid(),
  productId: z.uuid(),
  targetPest: z.string().max(200).nullish(),
  siteDesc: z.string().trim().min(1).max(500),
  method: z.string().max(100).nullish(),
  concentration: z.string().max(100).nullish(),
  totalAmount: z.number().positive().max(100000),
  amountUnit: z.string().trim().min(1).max(20),
  areaTreated: z.string().max(100).nullish(),
  appliedOn: z.iso.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  windMph: z.number().min(0).max(200).nullish(),
  tempF: z.number().min(-60).max(150).nullish(),
});

/**
 * Records an application (docs/SPEC.md screen 11). The EPA number and product name are copied from the product at the
 * time, so later edits to the product never change a legal record. Refused while a state-required field is missing.
 */
export async function recordApplication(tx: Tx, ctx: Ctx, b: z.infer<typeof phcBody>) {
  const [dupe] = await tx`select id from phc_applications where client_id = ${b.clientId}`;
  if (dupe) return { id: dupe.id as string, duplicate: true };
  const [prop] = await tx`select state_code from properties where id = ${b.propertyId}`;
  const [product] = await tx`select * from products where id = ${b.productId}`;
  const [w] = await tx`select full_name, applicator_license_no from workers where id = ${b.applicatorWorkerId}`;
  if (!prop || !product || !w) fail('not_found', 'Property, product or applicator not found.');
  const check = phcRecord(
    {
      product_name: product!.name, epa_reg_no: product!.epa_reg_no, total_amount: b.totalAmount, amount_unit: b.amountUnit, site_desc: b.siteDesc, applied_on: b.appliedOn,
      applicator_name: w!.full_name, applicator_license_no: w!.applicator_license_no ?? '', concentration: b.concentration ?? null, target_pest: b.targetPest ?? null, method: b.method ?? null,
      recorded_on: localParts(new Date(), ctx.tenant.timezone).day, is_rup: product!.is_rup,
    },
    prop!.state_code,
  );
  if (check.problems.length) fail('validation', check.problems.join(' '), { missing: check.missingFields });
  const id = crypto.randomUUID();
  const [row] = await tx`insert into phc_applications (id, copy_token_hash, tenant_id, program_id, property_id, applicator_worker_id, applicator_license_no, product_id, product_name, epa_reg_no, is_rup,
      target_pest, site_desc, method, concentration, total_amount, amount_unit, area_treated, applied_on, start_time, end_time, wind_mph, temp_f, state_code, client_id)
    values (${id}, ${hashToken(derivedToken('phc', id))}, ${ctx.tenantId}, ${b.programId ?? null}, ${b.propertyId}, ${b.applicatorWorkerId}, ${w!.applicator_license_no}, ${b.productId}, ${product!.name}, ${product!.epa_reg_no}, ${product!.is_rup},
      ${b.targetPest ?? null}, ${b.siteDesc}, ${b.method ?? null}, ${b.concentration ?? null}, ${b.totalAmount}, ${b.amountUnit}, ${b.areaTreated ?? null}, ${b.appliedOn},
      ${b.startTime ?? null}, ${b.endTime ?? null}, ${b.windMph ?? null}, ${b.tempF ?? null}, ${prop!.state_code}, ${b.clientId})
    returning id`;
  // The customer link is derived from the id; only its hash is stored, and the row stays append-only.
  return { id: row!.id as string, duplicate: false, copyRequired: check.copyRequired };
}

export const copyLink = (id: string) => `${baseUrl()}/r/${derivedToken('phc', id)}`;

export async function sendCopy(ctx: Ctx, id: string) {
  const sql = db();
  const [a] = await sql`select a.*, c.phone, c.locale, c.id as customer_id from phc_applications a join properties p on p.id = a.property_id join customers c on c.id = p.customer_id where a.id = ${id} and a.tenant_id = ${ctx.tenantId}`;
  if (!a) fail('not_found', 'Record not found.');
  const link = copyLink(id);
  const text = await sendText({ tenantId: ctx.tenantId, to: a!.phone, template: 'phc_copy', locale: a!.locale, vars: { date: prettyDay(a!.applied_on, a!.locale), link }, customerId: a!.customer_id, related: { type: 'phc_application', id }, idemKey: `phc_copy:${id}` });
  return { link, text: text.status, smsHref: ['blocked_no_consent', 'no_phone', 'duplicate'].includes(text.status) ? smsHref(a!.phone, text.body) : null };
}

export async function applicationByToken(token: string) {
  const sql = db();
  const rows = await sql`select a.*, t.name as company, t.phone as company_phone, c.name as customer_name, p.address, w.full_name as applicator
    from phc_applications a join tenants t on t.id = a.tenant_id join properties p on p.id = a.property_id join customers c on c.id = p.customer_id join workers w on w.id = a.applicator_worker_id
    where a.copy_token_hash = ${hashToken(token)}`;
  return rows[0] ?? null;
}
