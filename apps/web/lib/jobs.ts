import { db, type Q, type Tx } from '@treeops/db';
import { dayRange, equipmentConflict } from '@treeops/core/equipment';
import { preworkGate, type CheckRow } from '@treeops/core/prework';
import { z } from 'zod';
import type { Ctx } from './auth';
import { baseUrl } from './env';
import { fail } from './http';
import { sendText, smsHref } from './messaging';
import { encryptToken, hashToken, newToken } from './tokens';
import { refreshJobDay } from './weather';

export const jobDayBody = z.object({
  jobId: z.uuid(),
  crewId: z.uuid(),
  day: z.iso.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default('07:30'),
  estHours: z.number().positive().max(24).default(8),
  equipmentIds: z.array(z.uuid()).max(20).default([]),
});

export const prettyDay = (day: string, locale: 'en' | 'es' = 'en') =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

async function gateFor(tx: Q, jobId: string, day: string) {
  const checks = (await tx`select id, kind, status, override_reason, valid_until from prework_checks where job_id = ${jobId}`) as unknown as CheckRow[];
  return preworkGate(checks, day);
}

/** Equipment clashes for a set of equipment on a day, ignoring this job day's own bookings. */
async function clashes(tx: Q, ctx: Ctx, equipmentIds: string[], range: { start: Date; end: Date }, jobDayId?: string) {
  if (!equipmentIds.length) return [];
  const existing = await tx`select b.id, b.job_day_id, b.equipment_id, lower(b.during) as start, upper(b.during) as "end", e.name, j.number
    from equipment_bookings b join equipment e on e.id = b.equipment_id join job_days jd on jd.id = b.job_day_id join jobs j on j.id = jd.job_id
    where b.equipment_id = any(${equipmentIds}) and b.during && tstzrange(${range.start}, ${range.end})`;
  return equipmentConflict(
    existing.map((x) => ({ id: x.id, job_day_id: x.job_day_id, equipment_id: x.equipment_id, start: new Date(x.start), end: new Date(x.end), label: `${x.name} is booked on job ${x.number}` })),
    equipmentIds.map((equipment_id) => ({ equipment_id, job_day_id: jobDayId, ...range })),
  );
}

/**
 * Puts a job on the board (docs/SPEC.md section 9, POST /job-days): refused as `gated` while a pre-work check is open
 * without an override, and as `conflict` when equipment is already booked. The database's exclusion constraint is the
 * backstop for two people booking at once.
 */
export async function scheduleJobDay(tx: Tx, ctx: Ctx, b: z.infer<typeof jobDayBody>) {
  const [job] = await tx`select id, status from jobs where id = ${b.jobId}`;
  if (!job) fail('not_found', 'Job not found.');
  if (['done', 'billed', 'cancelled'].includes(job!.status)) fail('conflict', `This job is ${job!.status}.`);
  const gate = await gateFor(tx, b.jobId, b.day);
  if (!gate.ok) fail('gated', 'Finish or override the pre-work checks first.', { blocking: gate.blocking });
  const range = dayRange(b.day, b.startTime, b.estHours, ctx.tenant.timezone);
  const clash = await clashes(tx, ctx, b.equipmentIds, range);
  if (clash.length) fail('conflict', clash.map((c) => c.clash.label).join('. ') + '.', { clashes: clash.map((c) => ({ equipmentId: c.equipment_id, clash: c.clash.label })) });
  const [jd] = await tx`insert into job_days (tenant_id, job_id, crew_id, day, start_time, est_hours) values (${ctx.tenantId}, ${b.jobId}, ${b.crewId}, ${b.day}, ${b.startTime}, ${b.estHours}) returning id`;
  for (const eq of b.equipmentIds) await tx`insert into equipment_bookings (tenant_id, equipment_id, job_day_id, during) values (${ctx.tenantId}, ${eq}, ${jd!.id}, tstzrange(${range.start}, ${range.end}))`;
  await tx`update jobs set status = 'scheduled' where id = ${b.jobId} and status = 'unscheduled'`;
  return jd!.id as string;
}

/** After the transaction commits: forecast and the "scheduled" text. Failures here never undo the booking. */
export async function afterScheduled(ctx: Ctx, jobDayId: string, notify: boolean) {
  await refreshJobDay(jobDayId).catch(() => null);
  if (!notify) return null;
  const [r] = await db()`select jd.day, c.phone, c.locale, c.id as customer_id from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id where jd.id = ${jobDayId}`;
  if (!r) return null;
  return sendText({ tenantId: ctx.tenantId, to: r.phone, template: 'scheduled', locale: r.locale, vars: { date: prettyDay(r.day, r.locale) }, customerId: r.customer_id, related: { type: 'job_day', id: jobDayId }, idemKey: `scheduled:${jobDayId}:${r.day}` });
}

export const moveBody = z.object({ day: z.iso.date(), crewId: z.uuid().optional(), startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), weather: z.boolean().default(false) });

/** Moves a job day (drag on the board, or "move for weather"). Same gate and equipment rules as a new booking. */
export async function moveJobDay(tx: Tx, ctx: Ctx, jobDayId: string, b: z.infer<typeof moveBody>) {
  const [jd] = await tx`select * from job_days where id = ${jobDayId}`;
  if (!jd) fail('not_found', 'Job day not found.');
  if (['working', 'closed'].includes(jd!.status)) fail('conflict', 'Work already started on this day; it can’t move.');
  const gate = await gateFor(tx, jd!.job_id, b.day);
  if (!gate.ok) fail('gated', 'Finish or override the pre-work checks first.', { blocking: gate.blocking });
  const startTime = b.startTime ?? String(jd!.start_time).slice(0, 5);
  const range = dayRange(b.day, startTime, Number(jd!.est_hours), ctx.tenant.timezone);
  const equipment = (await tx`select equipment_id from equipment_bookings where job_day_id = ${jobDayId}`).map((r) => r.equipment_id as string);
  const clash = await clashes(tx, ctx, equipment, range, jobDayId);
  if (clash.length) fail('conflict', clash.map((c) => c.clash.label).join('. ') + '.', { clashes: clash.map((c) => ({ equipmentId: c.equipment_id, clash: c.clash.label })) });
  await tx`update job_days set day = ${b.day}, crew_id = ${b.crewId ?? jd!.crew_id}, start_time = ${startTime}, status = 'planned' where id = ${jobDayId}`;
  await tx`update equipment_bookings set during = tstzrange(${range.start}, ${range.end}) where job_day_id = ${jobDayId}`;
  return { from: jd!.day as string, to: b.day };
}

export async function afterMoved(ctx: Ctx, jobDayId: string, weather: boolean) {
  await refreshJobDay(jobDayId).catch(() => null);
  const [r] = await db()`select jd.day, c.phone, c.locale, c.id as customer_id from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id where jd.id = ${jobDayId}`;
  if (!r) return null;
  const vars = { date: prettyDay(r.day, r.locale), phone: ctx.tenant.phone ?? '' };
  return sendText({ tenantId: ctx.tenantId, to: r.phone, template: weather ? 'weather_reschedule' : 'scheduled', locale: r.locale, vars, customerId: r.customer_id, related: { type: 'job_day', id: jobDayId }, idemKey: `${weather ? 'wx' : 'moved'}:${jobDayId}:${r.day}` });
}

export const checkBody = z.object({
  kind: z.enum(['811', 'permit', 'hoa', 'utility_line', 'neighbor', 'other']),
  status: z.enum(['needed', 'requested', 'cleared', 'not_required']),
  refNo: z.string().max(80).nullish(),
  validFrom: z.iso.datetime({ offset: true }).nullish().or(z.iso.date().nullish()),
  validUntil: z.iso.datetime({ offset: true }).nullish().or(z.iso.date().nullish()),
});

export async function upsertCheck(tx: Tx, ctx: Ctx, jobId: string, b: z.infer<typeof checkBody>) {
  const [row] = await tx`
    insert into prework_checks (tenant_id, job_id, kind, status, ref_no, requested_at, valid_from, valid_until)
    values (${ctx.tenantId}, ${jobId}, ${b.kind}, ${b.status}, ${b.refNo ?? null}, ${b.status === 'requested' ? new Date() : null}, ${b.validFrom ?? null}, ${b.validUntil ?? null})
    on conflict (job_id, kind) do update set status = excluded.status, ref_no = coalesce(excluded.ref_no, prework_checks.ref_no),
      requested_at = coalesce(prework_checks.requested_at, excluded.requested_at), valid_from = excluded.valid_from, valid_until = excluded.valid_until,
      override_reason = null, override_by = null
    returning id`;
  return row!.id as string;
}

/** Owner or office only (also enforced in the database); the reason is kept and the change is in the audit log. */
export async function overrideCheck(tx: Tx, checkId: string, reason: string) {
  if (reason.trim().length < 10) fail('validation', 'Say why in at least 10 characters.');
  const [row] = await tx`update prework_checks set status = 'overridden', override_reason = ${reason.trim()} where id = ${checkId} returning id`;
  if (!row) fail('not_found', 'Check not found.');
}

/** A crew link for one job day: works until the end of the day plus two days (docs/SPEC.md section 9). */
export async function createCrewLink(tx: Tx, ctx: Ctx, jobDayId: string) {
  const [jd] = await tx`select jd.day, jd.crew_id, p.address, c.leader_worker_id from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id left join crews c on c.id = jd.crew_id where jd.id = ${jobDayId}`;
  if (!jd) fail('not_found', 'Job day not found.');
  await tx`update crew_links set revoked = true where job_day_id = ${jobDayId} and not revoked`;
  const token = newToken();
  const expires = new Date(`${jd!.day}T23:59:59Z`);
  expires.setUTCDate(expires.getUTCDate() + 2);
  await tx`insert into crew_links (tenant_id, job_day_id, token_hash, token_enc, expires_at) values (${ctx.tenantId}, ${jobDayId}, ${hashToken(token)}, ${encryptToken(token)}, ${expires})`;
  return { url: `${baseUrl()}/c/${token}`, leaderId: jd!.leader_worker_id as string | null, day: jd!.day as string, address: jd!.address as string };
}

export async function textCrewLink(ctx: Ctx, jobDayId: string, link: { url: string; leaderId: string | null; day: string; address: string }) {
  if (!link.leaderId) return null;
  const [w] = await db()`select id, phone, locale from workers where id = ${link.leaderId} and tenant_id = ${ctx.tenantId}`;
  if (!w) return null;
  const out = await sendText({ tenantId: ctx.tenantId, to: w.phone, template: 'crew_link', locale: w.locale, vars: { date: prettyDay(link.day, w.locale), address: link.address, link: link.url }, workerId: w.id, related: { type: 'job_day', id: jobDayId }, idemKey: `crew_link:${jobDayId}:${link.url.slice(-8)}` });
  return { ...out, smsHref: out.status === 'blocked_no_consent' ? smsHref(w.phone, out.body) : null };
}
