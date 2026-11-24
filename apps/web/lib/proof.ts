import { db, type Q } from '@treeops/db';
import { manifestHash, sortPhotos } from '@treeops/core/proof';
import { renderProofPacket, type ProofManifest } from '@treeops/providers/pdf';
import { fail } from './http';
import { loadOptions } from './estimates';
import { get, put, signedUrl } from './storage';

const iso = (d: unknown) => (d === null || d === undefined ? null : new Date(d as string).toISOString());
const maskPhone = (p: string) => p.replace(/\d(?=\d{4})/g, '•');

/**
 * The proof packet's manifest (docs/SPEC.md section 11, proofManifest). Built only from stored records, in a fixed
 * order, with no "generated at" inside, so rebuilding unchanged data gives the same hash.
 */
export async function buildManifest(tenantId: string, jobId: string, sql: Q = db()): Promise<ProofManifest> {
  const [j] = await sql`select j.*, t.name as company, c.name as customer, p.address, p.city, p.state_code, p.lat, p.lon, e.number as est_number, e.approved_at, e.total_cents, e.id as estimate_id
    from jobs j join tenants t on t.id = j.tenant_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id join estimates e on e.id = j.estimate_id
    where j.id = ${jobId} and j.tenant_id = ${tenantId}`;
  if (!j) fail('not_found', 'Job not found.');
  const options = await loadOptions(sql, j!.estimate_id);
  const trees = await sql`select id, number, label, species_common, dbh_in, near_lines from trees where property_id = ${j!.property_id} and tenant_id = ${tenantId} order by number`;
  const num = new Map(trees.map((t) => [t.id as string, t.number as number]));
  const days = await sql`select jd.id, jd.day, jd.status, jd.weather_flags, c.name as crew from job_days jd left join crews c on c.id = jd.crew_id where jd.job_id = ${jobId} and jd.tenant_id = ${tenantId} order by jd.day, jd.id`;
  const dayOf = new Map(days.map((d) => [d.id as string, d.day as string]));
  const dayIds = days.map((d) => d.id as string);
  const workers = new Map((await sql`select id, full_name from workers where tenant_id = ${tenantId}`).map((w) => [w.id as string, w.full_name as string]));
  const coIds = (await sql`select id from change_orders where job_id = ${jobId} and tenant_id = ${tenantId}`).map((r) => r.id as string);
  const briefs = dayIds.length ? await sql`select * from briefings where job_day_id = any(${dayIds}) and tenant_id = ${tenantId} order by completed_at, id` : [];
  const signoffs = briefs.length ? await sql`select * from briefing_signoffs where briefing_id = any(${briefs.map((b) => b.id)}) and tenant_id = ${tenantId} order by signed_at, id` : [];
  const photos = await sql`select id, kind, sha256, taken_at, tree_id, lat, lon from photos where tenant_id = ${tenantId} and (estimate_id = ${j!.estimate_id} or job_day_id = any(${dayIds}))`;
  const shaOf = new Map(photos.map((p) => [p.id as string, p.sha256 as string]));
  const confirmations = dayIds.length ? await sql`select * from tree_confirmations where job_day_id = any(${dayIds}) and tenant_id = ${tenantId} order by at, id` : [];
  const lineDesc = new Map(options.flatMap((o) => o.lines).map((l) => [l.id, l.description]));
  const work = dayIds.length ? await sql`select * from work_log where job_day_id = any(${dayIds}) and tenant_id = ${tenantId} order by at, id` : [];
  const cos = await sql`select co.*, s.signer_name, s.signed_at from change_orders co left join signatures s on s.id = co.signature_id where co.job_id = ${jobId} and co.tenant_id = ${tenantId} order by co.created_at, co.id`;
  const sigs = await sql`select subject_type, signer_name, signed_at, sha256 from signatures where tenant_id = ${tenantId} and (subject_id = ${j!.estimate_id} or subject_id = any(${coIds.length ? coIds : ['00000000-0000-0000-0000-000000000000']})) order by signed_at, id`;
  const checks = await sql`select kind, status, ref_no, valid_until, override_reason from prework_checks where job_id = ${jobId} and tenant_id = ${tenantId} order by kind`;
  const msgs = await sql`select template, to_phone, status, created_at from messages where tenant_id = ${tenantId} and related_id = any(${[j!.estimate_id, jobId, ...dayIds, ...coIds]}) order by created_at, id`;
  const targetIds = [...dayIds, ...briefs.map((b) => b.id as string), ...confirmations.map((c) => c.id as string), ...work.map((w) => w.id as string)];
  const corrections = targetIds.length ? await sql`select target_table, field, new_value, reason, created_at from corrections where tenant_id = ${tenantId} and target_id = any(${targetIds}) order by created_at, id` : [];
  const weather = days.length ? await sql`select distinct on (for_date) for_date, source, fetched_at, sha256, flags from weather_snapshots where tenant_id = ${tenantId} and for_date = any(${days.map((d) => d.day)}) and lat = ${j!.lat} and lon = ${j!.lon} order by for_date, fetched_at desc` : [];

  return {
    version: 1,
    company: { name: j!.company },
    job: { id: jobId, number: j!.number, status: j!.status, created_at: iso(j!.created_at)!, closed_at: iso(j!.closed_at) },
    customer: { name: j!.customer },
    property: { address: j!.address, city: j!.city, state_code: j!.state_code, lat: j!.lat === null ? null : Number(j!.lat), lon: j!.lon === null ? null : Number(j!.lon) },
    estimate: { number: j!.est_number, approved_at: iso(j!.approved_at), total_cents: j!.total_cents, options: options.map((o) => ({ name: o.name, included: o.required || o.selected, lines: o.lines.map((l) => ({ id: l.id, kind: l.kind, description: l.description, qty: l.qty, unit: l.unit, unit_price_cents: l.unit_price_cents, tree_number: l.tree_id ? (num.get(l.tree_id) ?? null) : null })) })) },
    signatures: sigs.map((s) => ({ subject_type: s.subject_type, signer_name: s.signer_name, signed_at: iso(s.signed_at)!, sha256: s.sha256 })),
    trees: trees.map((t) => ({ id: t.id, number: t.number, label: t.label, species: t.species_common, dbh_in: t.dbh_in === null ? null : Number(t.dbh_in), near_lines: t.near_lines })),
    checks: checks.map((c) => ({ kind: c.kind, status: c.status, ref_no: c.ref_no, valid_until: iso(c.valid_until), override_reason: c.override_reason })),
    job_days: days.map((d) => ({ id: d.id, day: d.day, crew: d.crew, status: d.status, weather_flags: (d.weather_flags as { kind: string; message: string }[]).map((f) => ({ kind: f.kind, message: f.message })) })),
    briefings: briefs.map((b) => ({
      day: dayOf.get(b.job_day_id)!, completed_at: iso(b.completed_at)!, leader: workers.get(b.leader_worker_id) ?? 'Unknown', hazards: b.hazards as string[], line_proximity: b.line_proximity,
      hospital: b.hospital_name ? `${b.hospital_name}${b.hospital_address ? `, ${b.hospital_address}` : ''}` : null, emergency_address: b.emergency_address, rescue_plan: b.rescue_plan, is_rebrief: b.is_rebrief,
      signoffs: signoffs.filter((x) => x.briefing_id === b.id).map((x) => ({ worker: workers.get(x.worker_id) ?? 'Unknown', signed_at: iso(x.signed_at)!, late_arrival: x.late_arrival })),
    })),
    work_log: work.map((w) => ({ day: dayOf.get(w.job_day_id)!, worker: w.worker_id ? (workers.get(w.worker_id) ?? null) : null, kind: w.kind, at: iso(w.at)!, value: w.value === null ? null : Number(w.value), note: w.note })),
    confirmations: confirmations.map((c) => ({ day: dayOf.get(c.job_day_id)!, tree_number: c.tree_id ? (num.get(c.tree_id) ?? null) : null, line: lineDesc.get(c.line_id) ?? 'Removed line', result: c.result, reason: c.reason, at: iso(c.at)!, by: c.confirmed_by ? (workers.get(c.confirmed_by) ?? null) : null, before_photo_sha256: c.before_photo_id ? (shaOf.get(c.before_photo_id) ?? null) : null, after_photo_sha256: c.after_photo_id ? (shaOf.get(c.after_photo_id) ?? null) : null, lat: c.lat === null ? null : Number(c.lat), lon: c.lon === null ? null : Number(c.lon) })),
    photos: sortPhotos(photos.map((p) => ({ id: p.id as string, kind: p.kind as string, sha256: p.sha256 as string, taken_at: iso(p.taken_at)!, tree_number: p.tree_id ? (num.get(p.tree_id) ?? null) : null, lat: p.lat === null ? null : Number(p.lat), lon: p.lon === null ? null : Number(p.lon) }))),
    change_orders: cos.map((c) => ({ description: c.description, amount_cents: c.amount_cents, status: c.status, signer: c.signer_name ?? null, signed_at: iso(c.signed_at) })),
    messages: msgs.map((m) => ({ template: m.template, to: maskPhone(m.to_phone), status: m.status, at: iso(m.created_at)! })),
    corrections: corrections.map((c) => ({ target_table: c.target_table, field: c.field, new_value: c.new_value, reason: c.reason, at: iso(c.created_at)! })),
    weather: weather.map((w) => ({ for_date: w.for_date, source: w.source, fetched_at: iso(w.fetched_at)!, sha256: w.sha256, flags: (w.flags as { kind: string; message: string }[]).map((f) => ({ kind: f.kind, message: f.message })) })),
  };
}

/** Builds, renders and stores the packet. The PDF is stored under its manifest hash. */
export async function generatePacket(tenantId: string, jobId: string, userId: string | null) {
  const sql = db();
  const manifest = await buildManifest(tenantId, jobId, sql);
  const hash = manifestHash(manifest);
  const [t] = await sql`select timezone from tenants where id = ${tenantId}`;
  const images = new Map<string, { data: Uint8Array; format: 'jpg' | 'png' }>();
  const paths = await sql`select id, storage_path from photos where id = any(${manifest.photos.map((p) => p.id)}) and tenant_id = ${tenantId} and storage_path ~* '\\.(jpe?g|png)$'`;
  for (const p of paths.slice(0, 120)) {
    const bytes = await get('photos', p.storage_path);
    if (bytes) images.set(p.id, { data: bytes, format: /\.png$/i.test(p.storage_path) ? 'png' : 'jpg' });
  }
  const pdf = await renderProofPacket({ manifest, hash, generatedAt: new Date(), timeZone: t!.timezone, images });
  const path = `${tenantId}/${jobId}/${hash}.pdf`;
  await put('packets', path, pdf, 'application/pdf');
  const [row] = await sql`insert into proof_packets (tenant_id, job_id, sha256, pdf_path, manifest, created_by) values (${tenantId}, ${jobId}, ${hash}, ${path}, ${sql.json(manifest as never)}, ${userId}) returning id`;
  return { id: row!.id as string, sha256: hash, url: await signedUrl('packets', path) };
}
