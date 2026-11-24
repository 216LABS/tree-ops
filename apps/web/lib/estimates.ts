import { asService, db, type Q, type Tx } from '@treeops/db';
import { priceEstimate, sendProblems, type PriceOption } from '@treeops/core/pricing';
import { requiredChecks, type PreworkRule } from '@treeops/core/prework';
import { requiredLevel } from '@treeops/core/electrical';
import { paymentFee } from '@treeops/core/fees';
import { dollars } from '@treeops/core/money';
import { settingsOf } from '@treeops/core/settings';
import { z } from 'zod';
import type { Ctx } from './auth';
import { baseUrl } from './env';
import { fail } from './http';
import { recordConsent, sendText, smsHref } from './messaging';
import { saveSignature } from './photos';
import { hashToken, newToken } from './tokens';

export const lineSchema = z.object({
  id: z.uuid(),
  treeId: z.uuid().nullish(),
  kind: z.enum(['remove', 'prune', 'stump_grind', 'cable_brace', 'phc', 'clearing', 'crane', 'equipment', 'disposal', 'permit_fee', 'other']),
  description: z.string().trim().min(1).max(500),
  qty: z.number().positive().max(100000),
  unit: z.enum(['each', 'hour', 'day', 'inch_dbh', 'load', 'lump']),
  unitPriceCents: z.number().int().min(0).max(100_000_000),
  estCrewHours: z.number().min(0).max(10000).nullish(),
  equipmentType: z.string().max(40).nullish(),
});
export const estimateBody = z.object({
  depositPct: z.number().int().min(0).max(100),
  validUntil: z.iso.date().nullish(),
  notes: z.string().max(4000).nullish(),
  options: z.array(z.object({ id: z.uuid(), name: z.string().trim().min(1).max(120), required: z.boolean(), selected: z.boolean(), lines: z.array(lineSchema).max(200) })).max(20),
});
export type EstimateBody = z.infer<typeof estimateBody>;

export const treeBody = z.object({
  propertyId: z.uuid(),
  number: z.number().int().min(1).max(999),
  label: z.string().trim().min(1).max(80),
  speciesCommon: z.string().max(80).nullish(),
  speciesLatin: z.string().max(80).nullish(),
  dbhIn: z.number().positive().max(400).nullish(),
  heightFt: z.number().int().min(1).max(400).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lon: z.number().min(-180).max(180).nullish(),
  condition: z.enum(['good', 'fair', 'poor', 'dead', 'hazard']).nullish(),
  nearLines: z.enum(['none', 'service_le_750v', 'dist_le_35kv', 'gt_35kv']),
  notes: z.string().max(1000).nullish(),
});

export async function createEstimate(tx: Tx, ctx: Ctx, propertyId: string) {
  const [prop] = await tx`select id from properties where id = ${propertyId}`;
  if (!prop) fail('not_found', 'Property not found.');
  const [n] = await tx`select app.next_number(${ctx.tenantId}, 'estimate') as n`;
  const valid = new Date(Date.now() + ctx.settings.estimate_valid_days * 86_400_000).toISOString().slice(0, 10);
  const [e] = await tx`insert into estimates (tenant_id, property_id, sales_user_id, number, valid_until, deposit_pct)
    values (${ctx.tenantId}, ${propertyId}, ${ctx.userId}, ${n!.n}, ${valid}, ${ctx.settings.default_deposit_pct}) returning id`;
  const opt = crypto.randomUUID();
  await tx`insert into estimate_options (id, tenant_id, estimate_id, name, required, sort) values (${opt}, ${ctx.tenantId}, ${e!.id}, 'Tree work', true, 0)`;
  return e!.id as string;
}

export async function upsertTree(tx: Tx, ctx: Ctx, id: string, b: z.infer<typeof treeBody>) {
  const [row] = await tx`
    insert into trees (id, tenant_id, property_id, number, label, species_common, species_latin, dbh_in, height_ft, lat, lon, condition, near_lines, notes)
    values (${id}, ${ctx.tenantId}, ${b.propertyId}, ${b.number}, ${b.label}, ${b.speciesCommon ?? null}, ${b.speciesLatin ?? null}, ${b.dbhIn ?? null}, ${b.heightFt ?? null},
      ${b.lat ?? null}, ${b.lon ?? null}, ${b.condition ?? null}, ${b.nearLines}, ${b.notes ?? null})
    on conflict (id) do update set number = excluded.number, label = excluded.label, species_common = excluded.species_common, species_latin = excluded.species_latin,
      dbh_in = excluded.dbh_in, height_ft = excluded.height_ft, lat = excluded.lat, lon = excluded.lon, condition = excluded.condition, near_lines = excluded.near_lines, notes = excluded.notes
    returning id`;
  return row!.id as string;
}

export async function loadOptions(sql: Q, estimateId: string): Promise<PriceOption[]> {
  const opts = await sql`select * from estimate_options where estimate_id = ${estimateId} order by sort, created_at`;
  const lines = await sql`select l.* from estimate_lines l join estimate_options o on o.id = l.option_id where o.estimate_id = ${estimateId} order by l.sort, l.created_at`;
  return opts.map((o) => ({
    id: o.id, name: o.name, required: o.required, selected: o.selected,
    lines: lines.filter((l) => l.option_id === o.id).map((l) => ({ id: l.id, kind: l.kind, description: l.description, qty: Number(l.qty), unit: l.unit, unit_price_cents: l.unit_price_cents, tree_id: l.tree_id, est_crew_hours: l.est_crew_hours === null ? null : Number(l.est_crew_hours), equipment_type: l.equipment_type })),
  }));
}

/** Replaces the options and lines of a draft. A sent or approved estimate is locked; make a new version instead. */
export async function saveEstimate(tx: Tx, ctx: Ctx, id: string, b: EstimateBody) {
  const [e] = await tx`select status from estimates where id = ${id}`;
  if (!e) fail('not_found', 'Estimate not found.');
  if (e!.status !== 'draft') fail('conflict', 'This estimate was sent, so it can’t change. Make a new version.');
  await tx`delete from estimate_options where estimate_id = ${id}`;
  let sort = 0;
  for (const o of b.options) {
    await tx`insert into estimate_options (id, tenant_id, estimate_id, name, required, selected, sort) values (${o.id}, ${ctx.tenantId}, ${id}, ${o.name}, ${o.required}, ${o.selected}, ${sort++})`;
    let ls = 0;
    for (const l of o.lines) {
      await tx`insert into estimate_lines (id, tenant_id, option_id, tree_id, kind, description, qty, unit, unit_price_cents, est_crew_hours, equipment_type, sort)
        values (${l.id}, ${ctx.tenantId}, ${o.id}, ${l.treeId ?? null}, ${l.kind}, ${l.description}, ${l.qty}, ${l.unit}, ${l.unitPriceCents}, ${l.estCrewHours ?? null}, ${l.equipmentType ?? null}, ${ls++})`;
    }
  }
  const priced = priceEstimate(await loadOptions(tx, id), ctx.settings, b.depositPct);
  await tx`update estimates set deposit_pct = ${b.depositPct}, valid_until = ${b.validUntil ?? null}, notes = ${b.notes ?? null}, total_cents = ${priced.totalCents} where id = ${id}`;
  return { totalCents: priced.totalCents, depositCents: priced.depositCents };
}

/** Trees on this estimate's lines that have a photo with their number drawn on. */
async function markedTrees(sql: Q, estimateId: string) {
  const rows = await sql`select distinct m.tree_id from photo_markups m join photos p on p.id = m.photo_id where p.estimate_id = ${estimateId}`;
  return new Set(rows.map((r) => r.tree_id as string));
}

export async function sendEstimate(tx: Tx, ctx: Ctx, id: string) {
  const [e] = await tx`select e.*, c.phone, c.locale, c.id as customer_id from estimates e join properties p on p.id = e.property_id join customers c on c.id = p.customer_id where e.id = ${id}`;
  if (!e) fail('not_found', 'Estimate not found.');
  if (!['draft', 'sent'].includes(e!.status)) fail('conflict', `This estimate is ${e!.status}.`);
  const problems = sendProblems(await loadOptions(tx, id), await markedTrees(tx, id));
  if (problems.length) fail('validation', problems.join(' '), { problems });
  const token = newToken();
  await tx`update estimates set status = 'sent', sent_at = now(), public_token_hash = ${hashToken(token)} where id = ${id}`;
  const link = `${baseUrl()}/e/${token}`;
  const text = await sendText({ tenantId: ctx.tenantId, to: e!.phone, template: 'estimate_sent', locale: e!.locale, vars: { link }, customerId: e!.customer_id, related: { type: 'estimate', id }, idemKey: `estimate_sent:${id}:${token.slice(0, 8)}` });
  return { publicUrl: link, text: text.status, smsHref: text.status === 'blocked_no_consent' || text.status === 'no_phone' ? smsHref(e!.phone, text.body) : null };
}

/** The customer's approval page data, by token (no account). */
export async function estimateByToken(token: string) {
  const sql = db();
  const [e] = await sql`
    select e.*, to_jsonb(t) as tenant, c.name as customer_name, c.locale, c.phone, p.address, p.city, p.state_code
    from estimates e join tenants t on t.id = e.tenant_id join properties p on p.id = e.property_id join customers c on c.id = p.customer_id
    where e.public_token_hash = ${hashToken(token)}`;
  return e ?? null;
}

const approveBody = z.object({
  selectedOptionIds: z.array(z.uuid()).max(20),
  signerName: z.string().trim().min(2).max(120),
  signaturePng: z.string().max(600_000),
  clientId: z.uuid(),
  consentSms: z.boolean(),
});
export { approveBody };

/**
 * Approval (docs/SPEC.md screen 2): stores the signature with its hash, records the options chosen, creates the job, its
 * pre-work checks and the deposit. Repeating with the same clientId returns the same job.
 */
export async function approveEstimate(token: string, b: z.infer<typeof approveBody>, meta: { ip: string | null; userAgent: string | null }) {
  const e = await estimateByToken(token);
  if (!e) fail('not_found', 'This estimate link isn’t valid.');
  const tenantId = e!.tenant_id as string;
  const out = await asService(async (tx) => {
    const [prior] = await tx`select j.id from jobs j where j.estimate_id = ${e!.id} and j.tenant_id = ${tenantId}`;
    if (e!.status === 'approved' && prior) return { jobId: prior.id as string, already: true };
    if (e!.status !== 'sent') fail('conflict', e!.status === 'expired' ? 'This estimate has expired. Ask for a new one.' : `This estimate is ${e!.status}.`);
    if (e!.valid_until && e!.valid_until < new Date().toISOString().slice(0, 10)) fail('conflict', 'This estimate has expired. Ask for a new one.');
    const options = await loadOptions(tx, e!.id);
    const chosen = new Set(b.selectedOptionIds.filter((id) => options.some((o) => o.id === id && !o.required)));
    const settings = settingsOf((e!.tenant as { settings: unknown }).settings);
    const priced = priceEstimate(options, settings, e!.deposit_pct, chosen);
    if (priced.totalCents <= 0) fail('validation', 'Choose at least one piece of work.');
    await saveSignature(tx, { tenantId, subjectType: 'estimate', subjectId: e!.id, signerName: b.signerName, signerRole: 'customer', png: b.signaturePng, signedAt: new Date(), ip: meta.ip, userAgent: meta.userAgent, clientId: b.clientId });
    for (const o of options) await tx`update estimate_options set selected = ${o.required || chosen.has(o.id)} where id = ${o.id} and tenant_id = ${tenantId}`;
    await tx`update estimates set status = 'approved', approved_at = now(), total_cents = ${priced.totalCents} where id = ${e!.id} and tenant_id = ${tenantId}`;
    if (b.consentSms && e!.phone) await recordConsent(tx, tenantId, e!.phone, 'opted_in', 'estimate_approval_checkbox');
    // The job, its checks and its electrical level.
    const included = options.filter((o) => o.required || chosen.has(o.id));
    const lines = included.flatMap((o) => o.lines);
    const treeIds = [...new Set(lines.map((l) => l.tree_id).filter(Boolean) as string[])];
    const trees = treeIds.length ? await tx`select t.id, t.label, t.dbh_in, t.near_lines, coalesce(s.is_pine, false) as is_pine from trees t
      left join species s on lower(s.common_name) = lower(t.species_common) and (s.tenant_id is null or s.tenant_id = ${tenantId}) where t.id = any(${treeIds}) and t.tenant_id = ${tenantId}` : [];
    const rules = await tx`select * from prework_rules where tenant_id is null or tenant_id = ${tenantId}`;
    const [prop] = await tx`select state_code, city, hoa_name, customer_id from properties where id = ${e!.property_id}`;
    const checks = requiredChecks({ lines: lines.map((l) => ({ kind: l.kind, tree_id: l.tree_id })), trees: trees.map((t) => ({ id: t.id, label: t.label, dbh_in: t.dbh_in === null ? null : Number(t.dbh_in), near_lines: t.near_lines, is_pine: t.is_pine })), property: prop as never, rules: rules as unknown as PreworkRule[] });
    const level = requiredLevel(trees.map((t) => ({ near_lines: t.near_lines })));
    const [n] = await tx`select app.next_number(${tenantId}, 'job') as n`;
    const needsCrane = lines.some((l) => l.kind === 'crane' || l.equipment_type === 'crane');
    const [job] = await tx`insert into jobs (tenant_id, estimate_id, property_id, number, required_electrical_level, needs_crane)
      values (${tenantId}, ${e!.id}, ${e!.property_id}, ${n!.n}, ${level.level}, ${needsCrane}) returning id`;
    for (const c of checks) await tx`insert into prework_checks (tenant_id, job_id, kind, reason) values (${tenantId}, ${job!.id}, ${c.kind}, ${`${c.reason} ${c.source_note}`.slice(0, 600)}) on conflict (job_id, kind) do nothing`;
    if (priced.depositCents > 0) await tx`insert into deposits (tenant_id, estimate_id, amount_cents) values (${tenantId}, ${e!.id}, ${priced.depositCents}) on conflict (estimate_id) do nothing`;
    return { jobId: job!.id as string, already: false };
  });
  const [dep] = await db()`select id, amount_cents, status from deposits where estimate_id = ${e!.id}`;
  return { ...out, deposit: dep ? { amountCents: dep.amount_cents, status: dep.status, label: dollars(dep.amount_cents) } : null };
}

/** The fee for a payment, for the owner-facing footer. */
export const feeFor = (tenant: { plan: 'free' | 'pro' | 'enterprise' }, cents: number) => paymentFee(cents, tenant.plan);
