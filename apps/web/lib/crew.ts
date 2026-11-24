import { asService, db, type Q, type Tx } from '@treeops/db';
import { electricalGate, requiredLevel } from '@treeops/core/electrical';
import { TREE_KINDS } from '@treeops/core/pricing';
import { z } from 'zod';
import { fail } from './http';
import { loadOptions } from './estimates';
import { saveSignature } from './photos';
import { signedUrls } from './storage';
import { hashToken } from './tokens';

/**
 * The crew link (docs/SPEC.md screen 4). No login: the token is hashed and looked up, and every query below filters by
 * that link's tenant and job day (the scope), because this path runs on the server connection.
 */
export interface CrewScope { tenantId: string; jobDayId: string; jobId: string; propertyId: string; estimateId: string; linkId: string }

export async function resolveLink(token: string, sql: Q = db()): Promise<CrewScope> {
  const [l] = await sql`select l.id, l.tenant_id, l.job_day_id, l.expires_at, l.revoked, jd.job_id, j.property_id, j.estimate_id
    from crew_links l join job_days jd on jd.id = l.job_day_id and jd.tenant_id = l.tenant_id join jobs j on j.id = jd.job_id and j.tenant_id = l.tenant_id
    where l.token_hash = ${hashToken(token)}`;
  if (!l || l.revoked || new Date(l.expires_at) < new Date()) fail('gone', 'This link has ended. Ask your office for a new one.');
  return { tenantId: l!.tenant_id, jobDayId: l!.job_day_id, jobId: l!.job_id, propertyId: l!.property_id, estimateId: l!.estimate_id, linkId: l!.id };
}

/** Everything the phone needs to work offline for the day. */
export async function crewBundle(s: CrewScope) {
  const sql = db();
  await sql`update crew_links set opened_at = coalesce(opened_at, now()) where id = ${s.linkId} and tenant_id = ${s.tenantId}`;
  const [jd] = await sql`
    select jd.*, j.number as job_number, j.notes as job_notes, j.required_electrical_level, j.needs_crane, p.address, p.city, p.state_code, p.lat, p.lon, p.access_notes, p.gate_code, p.hazards,
      c.name as customer_name, cr.name as crew_name, cr.leader_worker_id, t.name as company, t.default_locale, t.phone as company_phone
    from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id
    join tenants t on t.id = jd.tenant_id left join crews cr on cr.id = jd.crew_id
    where jd.id = ${s.jobDayId} and jd.tenant_id = ${s.tenantId}`;
  const options = (await loadOptions(sql, s.estimateId)).filter((o) => o.required || o.selected);
  const lines = options.flatMap((o) => o.lines);
  const trees = await sql`select id, number, label, species_common, dbh_in, height_ft, condition, near_lines, notes, lat, lon from trees where property_id = ${s.propertyId} and tenant_id = ${s.tenantId} order by number`;
  const sales = await sql`select p.id, p.tree_id, p.storage_path, m.tree_id as marked_tree, m.shape, m.number, m.color
    from photos p left join lateral (select * from photo_markups pm where pm.photo_id = p.id and pm.tenant_id = p.tenant_id order by pm.created_at desc) m on true
    where p.estimate_id = ${s.estimateId} and p.tenant_id = ${s.tenantId} and p.kind = 'estimate' order by p.taken_at`;
  const urls = await signedUrls('photos', [...new Set(sales.map((p) => p.storage_path as string))], 60 * 60 * 72);
  const photosByTree = new Map<string, { id: string; url: string | null; marks: { shape: unknown; number: number; color: string }[] }[]>();
  for (const p of sales) {
    const tree = (p.marked_tree ?? p.tree_id) as string | null;
    if (!tree) continue;
    const list = photosByTree.get(tree) ?? [];
    let entry = list.find((x) => x.id === p.id);
    if (!entry) list.push((entry = { id: p.id, url: urls.get(p.storage_path) ?? null, marks: [] }));
    if (p.shape) entry.marks.push({ shape: p.shape, number: p.number, color: p.color });
    photosByTree.set(tree, list);
  }
  const workers = await sql`select w.id, w.full_name, w.electrical_level, w.locale, exists (select 1 from crew_members cm where cm.worker_id = w.id and cm.crew_id = ${jd!.crew_id}) as on_crew
    from workers w where w.tenant_id = ${s.tenantId} and w.active order by on_crew desc, w.full_name`;
  const equipment = await sql`select e.id, e.name, e.type from equipment_bookings b join equipment e on e.id = b.equipment_id where b.job_day_id = ${s.jobDayId} and b.tenant_id = ${s.tenantId}`;
  const hospitals = await sql`select name, address, phone from hospitals where tenant_id = ${s.tenantId} order by name`;
  const briefings = await sql`select b.id, b.client_id, b.completed_at, b.is_rebrief, b.abatement_plan_path, (select coalesce(json_agg(json_build_object('worker_id', so.worker_id, 'signed_at', so.signed_at, 'late', so.late_arrival)), '[]') from briefing_signoffs so where so.briefing_id = b.id) as signoffs
    from briefings b where b.job_day_id = ${s.jobDayId} and b.tenant_id = ${s.tenantId} order by b.completed_at`;
  const confirmations = await sql`select line_id, tree_id, result, reason, at from tree_confirmations where job_day_id in (select id from job_days where job_id = ${s.jobId} and tenant_id = ${s.tenantId}) and tenant_id = ${s.tenantId} order by at`;
  const changeOrders = await sql`select id, description, amount_cents, status, client_id from change_orders where job_id = ${s.jobId} and tenant_id = ${s.tenantId} order by created_at`;
  const level = requiredLevel(trees.filter((t) => lines.some((l) => l.tree_id === t.id)).map((t) => ({ near_lines: t.near_lines })));
  return {
    jobDay: { id: jd!.id, day: jd!.day, status: jd!.status, startTime: String(jd!.start_time).slice(0, 5), weatherFlags: jd!.weather_flags, crew: jd!.crew_name, leaderId: jd!.leader_worker_id },
    job: { id: s.jobId, number: jd!.job_number, notes: jd!.job_notes, requiredLevel: Math.max(level.level, jd!.required_electrical_level), needsAbatement: level.needsAbatement, needsCrane: jd!.needs_crane },
    company: { name: jd!.company, phone: jd!.company_phone, locale: jd!.default_locale },
    property: { address: jd!.address, city: jd!.city, state: jd!.state_code, lat: jd!.lat, lon: jd!.lon, accessNotes: jd!.access_notes, gateCode: jd!.gate_code, hazards: jd!.hazards, customer: jd!.customer_name },
    lines: lines.map((l) => ({ id: l.id, kind: l.kind, description: l.description, treeId: l.tree_id ?? null, qty: l.qty, unit: l.unit, treeWork: TREE_KINDS.includes(l.kind) && Boolean(l.tree_id) })),
    trees: trees.map((t) => ({ ...t, dbh_in: t.dbh_in === null ? null : Number(t.dbh_in), photos: photosByTree.get(t.id) ?? [] })),
    workers: workers.map((w) => ({ id: w.id, name: w.full_name, level: w.electrical_level, onCrew: w.on_crew })),
    equipment,
    hospitals,
    briefings,
    confirmations,
    changeOrders,
  };
}

const at = z.iso.datetime({ offset: true });
export const opSchema = z.discriminatedUnion('type', [
  z.object({ clientId: z.uuid(), type: z.literal('briefing'), payload: z.object({ leaderWorkerId: z.uuid(), hazards: z.array(z.string().max(60)).max(30), lineProximity: z.enum(['none', 'service_le_750v', 'dist_le_35kv', 'gt_35kv']), hospitalName: z.string().max(200).nullish(), hospitalAddress: z.string().max(300).nullish(), emergencyAddress: z.string().max(300).nullish(), rescuePlan: z.string().max(1000).nullish(), isRebrief: z.boolean().default(false), completedAt: at }) }),
  z.object({ clientId: z.uuid(), type: z.literal('signoff'), payload: z.object({ briefingClientId: z.uuid(), workerId: z.uuid(), signedAt: at, lateArrival: z.boolean().default(false) }) }),
  z.object({ clientId: z.uuid(), type: z.literal('work_log'), payload: z.object({ workerId: z.uuid().nullish(), equipmentId: z.uuid().nullish(), kind: z.enum(['arrive', 'start', 'pause', 'resume', 'leave', 'note', 'equipment_hours']), at, value: z.number().min(0).max(10000).nullish(), note: z.string().max(1000).nullish() }) }),
  z.object({ clientId: z.uuid(), type: z.literal('tree_confirm'), payload: z.object({ lineId: z.uuid(), treeId: z.uuid().nullish(), result: z.enum(['done', 'partial', 'skipped']), reason: z.string().max(300).nullish(), beforePhotoClientId: z.uuid().nullish(), afterPhotoClientId: z.uuid().nullish(), workerId: z.uuid().nullish(), at, lat: z.number().nullish(), lon: z.number().nullish() }) }),
  z.object({ clientId: z.uuid(), type: z.literal('change_order_propose'), payload: z.object({ description: z.string().trim().min(1).max(500), amountCents: z.number().int().min(0).max(100_000_000), workerId: z.uuid().nullish(), signature: z.object({ name: z.string().trim().min(2).max(120), png: z.string().max(600_000), signedAt: at, clientId: z.uuid() }).nullish() }) }),
  z.object({ clientId: z.uuid(), type: z.literal('disposal'), payload: z.object({ kind: z.enum(['chips', 'logs', 'brush', 'stumps']), loads: z.number().min(0).max(1000).nullish(), costCents: z.number().int().min(0).max(10_000_000).nullish(), site: z.string().max(200).nullish() }) }),
]);
export type CrewOp = z.infer<typeof opSchema>;
export type OpResult = { applied: string[]; dupes: string[]; rejected: { clientId: string; code: string; message: string }[]; retry: string[] };

class Reject extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
class Retry extends Error {}

/**
 * Applies a batch from the phone's outbox, in order, each in its own savepoint. A client id seen before is a dupe and
 * does nothing, so sending the same batch twice changes nothing (docs/SPEC.md section 16: offline flow).
 */
export async function applyOps(s: CrewScope, ops: CrewOp[], meta: { ip: string | null; userAgent: string | null }): Promise<OpResult> {
  const out: OpResult = { applied: [], dupes: [], rejected: [], retry: [] };
  await asService(async (tx) => {
    for (const op of ops) {
      try {
        const applied = await tx.savepoint((sp) => applyOne(sp as unknown as Tx, s, op, meta));
        (applied ? out.applied : out.dupes).push(op.clientId);
      } catch (err) {
        if (err instanceof Retry) out.retry.push(op.clientId);
        else if (err instanceof Reject) out.rejected.push({ clientId: op.clientId, code: err.code, message: err.message });
        else if ((err as { code?: string }).code === '23514') out.rejected.push({ clientId: op.clientId, code: 'validation', message: 'That record isn’t complete.' });
        else throw err;
      }
    }
  });
  return out;
}

const photoId = async (tx: Tx, s: CrewScope, clientId: string | null | undefined) => {
  if (!clientId) return null;
  const [p] = await tx`select id from photos where client_id = ${clientId} and tenant_id = ${s.tenantId}`;
  if (!p) throw new Retry('photo not here yet');
  return p.id as string;
};

async function applyOne(tx: Tx, s: CrewScope, op: CrewOp, meta: { ip: string | null; userAgent: string | null }): Promise<boolean> {
  const T = s.tenantId;
  const worker = async (id: string | null | undefined) => {
    if (!id) return null;
    const [w] = await tx`select id from workers where id = ${id} and tenant_id = ${T}`;
    if (!w) throw new Reject('validation', 'Unknown worker.');
    return w.id as string;
  };
  switch (op.type) {
    case 'briefing': {
      const p = op.payload;
      await worker(p.leaderWorkerId);
      const r = await tx`insert into briefings (tenant_id, job_day_id, leader_worker_id, hazards, line_proximity, hospital_name, hospital_address, emergency_address, rescue_plan, is_rebrief, completed_at, client_id)
        values (${T}, ${s.jobDayId}, ${p.leaderWorkerId}, ${tx.json(p.hazards)}, ${p.lineProximity}, ${p.hospitalName ?? null}, ${p.hospitalAddress ?? null}, ${p.emergencyAddress ?? null}, ${p.rescuePlan ?? null}, ${p.isRebrief}, ${p.completedAt}, ${op.clientId})
        on conflict (client_id) do nothing returning id`;
      if (r.length) await tx`update job_days set status = 'briefed' where id = ${s.jobDayId} and tenant_id = ${T} and status in ('planned','weather_hold')`;
      return r.length > 0;
    }
    case 'signoff': {
      const p = op.payload;
      const [b] = await tx`select id from briefings where client_id = ${p.briefingClientId} and tenant_id = ${T} and job_day_id = ${s.jobDayId}`;
      if (!b) throw new Retry('briefing not here yet');
      await worker(p.workerId);
      const r = await tx`insert into briefing_signoffs (tenant_id, briefing_id, worker_id, late_arrival, signed_at, client_id) values (${T}, ${b.id}, ${p.workerId}, ${p.lateArrival}, ${p.signedAt}, ${op.clientId})
        on conflict do nothing returning id`;
      return r.length > 0;
    }
    case 'work_log': {
      const p = op.payload;
      await worker(p.workerId);
      if (p.equipmentId) {
        const [e] = await tx`select id from equipment where id = ${p.equipmentId} and tenant_id = ${T}`;
        if (!e) throw new Reject('validation', 'Unknown equipment.');
      }
      const r = await tx`insert into work_log (tenant_id, job_day_id, worker_id, equipment_id, kind, at, value, note, client_id)
        values (${T}, ${s.jobDayId}, ${p.workerId ?? null}, ${p.equipmentId ?? null}, ${p.kind}, ${p.at}, ${p.value ?? null}, ${p.note ?? null}, ${op.clientId}) on conflict (client_id) do nothing returning id`;
      if (!r.length) return false;
      if (p.kind === 'arrive' || p.kind === 'start') {
        await tx`update job_days set status = 'working' where id = ${s.jobDayId} and tenant_id = ${T} and status in ('planned','briefed')`;
        await tx`update jobs set status = 'in_progress' where id = ${s.jobId} and tenant_id = ${T} and status in ('unscheduled','scheduled')`;
      }
      if (p.kind === 'equipment_hours' && p.equipmentId && p.value) await tx`update equipment set hour_meter = coalesce(hour_meter, 0) + ${p.value} where id = ${p.equipmentId} and tenant_id = ${T}`;
      return true;
    }
    case 'tree_confirm': {
      const p = op.payload;
      const [dupe] = await tx`select 1 from tree_confirmations where client_id = ${op.clientId}`;
      if (dupe) return false;
      const lines = (await loadOptions(tx, s.estimateId)).filter((o) => o.required || o.selected).flatMap((o) => o.lines);
      const line = lines.find((l) => l.id === p.lineId);
      if (!line) throw new Reject('validation', 'That work isn’t on this job.');
      // The briefing must be done, and someone on site must be qualified for the lines near these trees.
      const briefs = await tx`select b.id, b.abatement_plan_path from briefings b where b.job_day_id = ${s.jobDayId} and b.tenant_id = ${T}`;
      if (!briefs.length) throw new Reject('gated', 'Do the job briefing before tree work.');
      const signed = await tx`select distinct w.electrical_level from briefing_signoffs so join workers w on w.id = so.worker_id where so.briefing_id = any(${briefs.map((b) => b.id)}) and so.tenant_id = ${T}`;
      const trees = await tx`select near_lines from trees where id = any(${lines.map((l) => l.tree_id).filter(Boolean) as string[]}) and tenant_id = ${T}`;
      const need = requiredLevel(trees.map((t) => ({ near_lines: t.near_lines })));
      const gate = electricalGate(need, signed.map((x) => ({ electrical_level: x.electrical_level })), briefs.find((b) => b.abatement_plan_path)?.abatement_plan_path);
      if (!gate.ok) throw new Reject('gated', gate.reason!);
      const before = await photoId(tx, s, p.beforePhotoClientId);
      const after = await photoId(tx, s, p.afterPhotoClientId);
      if (p.result === 'done' && !after) throw new Reject('validation', 'Done needs an after photo.');
      if (p.result === 'skipped' && (p.reason ?? '').trim().length < 3) throw new Reject('validation', 'Say why it was skipped.');
      const r = await tx`insert into tree_confirmations (tenant_id, job_day_id, tree_id, line_id, result, reason, before_photo_id, after_photo_id, confirmed_by, lat, lon, at, client_id)
        values (${T}, ${s.jobDayId}, ${line.tree_id ?? null}, ${p.lineId}, ${p.result}, ${p.reason ?? null}, ${before}, ${after}, ${await worker(p.workerId)}, ${p.lat ?? null}, ${p.lon ?? null}, ${p.at}, ${op.clientId})
        on conflict (client_id) do nothing returning id`;
      return r.length > 0;
    }
    case 'change_order_propose': {
      const p = op.payload;
      const [dupe] = await tx`select 1 from change_orders where client_id = ${op.clientId}`;
      if (dupe) return false;
      const [co] = await tx`insert into change_orders (tenant_id, job_id, description, amount_cents, proposed_by_worker, client_id) values (${T}, ${s.jobId}, ${p.description}, ${p.amountCents}, ${await worker(p.workerId)}, ${op.clientId}) returning id`;
      if (p.signature) {
        const sig = await saveSignature(tx, { tenantId: T, subjectType: 'change_order', subjectId: co!.id, signerName: p.signature.name, signerRole: 'customer', png: p.signature.png, signedAt: new Date(p.signature.signedAt), ip: meta.ip, userAgent: meta.userAgent, clientId: p.signature.clientId });
        await tx`update change_orders set status = 'signed', signature_id = ${sig} where id = ${co!.id} and tenant_id = ${T}`;
      }
      return true;
    }
    case 'disposal': {
      const p = op.payload;
      const r = await tx`insert into disposal_tickets (tenant_id, job_day_id, kind, site, loads, cost_cents, client_id) values (${T}, ${s.jobDayId}, ${p.kind}, ${p.site ?? null}, ${p.loads ?? null}, ${p.costCents ?? null}, ${op.clientId})
        on conflict (client_id) do nothing returning id`;
      return r.length > 0;
    }
  }
}
