/**
 * The demo company (docs/SPEC.md section 17): "Maple Ridge Tree Co. (DEMO)", Ohio. Everything here is fictional and
 * labeled DEMO: people, addresses, products (EPA numbers "DEMO-####"). Safe to re-run: it removes the old demo first.
 * Local only. It refuses to run against a database that isn't on localhost.
 */
import { createClient } from '@supabase/supabase-js';
import { closeDb, db } from '@treeops/db';
import { createHash, randomUUID } from 'node:crypto';
import { demoTreePng } from '../lib/png';
import { DEMO } from '../lib/env';
import { derivedToken, hashToken } from '../lib/tokens';

const url = process.env.DATABASE_URL ?? '';
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('seed:demo only runs against a local database');

const sql = db();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const SLUG = 'maple-ridge-demo';

async function user(email: string) {
  const [found] = await sql`select id from auth.users where email = ${email}`;
  if (found) {
    await sb.auth.admin.updateUserById(found.id, { password: DEMO.password });
    return found.id;
  }
  const { data, error } = await sb.auth.admin.createUser({ email, password: DEMO.password, email_confirm: true });
  if (error || !data.user) throw new Error(`could not create ${email}: ${error?.message}`);
  return data.user.id;
}

async function upload(tenantId: string, propertyId: string, clientId: string, seed: number) {
  const png = demoTreePng(seed);
  const path = `${tenantId}/${propertyId}/${new Date().getUTCFullYear()}/${clientId}.png`;
  const { error } = await sb.storage.from('photos').upload(path, png, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`storage: ${error.message}`);
  return { path, sha256: sha(png) };
}

async function main() {
  // Remove the previous demo. Append-only triggers are switched off for this local-only cleanup.
  await sql.begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    const [old] = await tx`select id from tenants where slug = ${SLUG}`;
    if (old) {
      for (const t of ['audit_log', 'idempotency_keys', 'jobs_queue', 'counters', 'proof_packets', 'payments', 'invoice_lines', 'invoices', 'disposal_tickets', 'corrections', 'tree_confirmations', 'work_log', 'briefing_signoffs', 'briefings',
        'change_orders', 'crew_links', 'equipment_bookings', 'job_days', 'prework_checks', 'claims', 'jobs', 'deposits', 'signatures', 'photo_markups', 'photos', 'estimate_lines', 'estimate_options', 'phc_applications', 'phc_programs',
        'estimates', 'storm_intake', 'storm_events', 'trees', 'properties', 'messages', 'consents', 'customers', 'weather_snapshots', 'crew_members', 'crews', 'workers', 'equipment', 'hospitals', 'products', 'certificates',
        'prework_rules', 'species', 'memberships', 'branches']) await tx.unsafe(`delete from ${t} where tenant_id = $1`, [old.id]);
      await tx`delete from tenants where id = ${old.id}`;
    }
  });

  const owner = await user(DEMO.email);
  const sales = await user(DEMO.sales);
  const office = await user(DEMO.office);

  const T = randomUUID();
  await sql`insert into tenants (id, name, slug, state_code, timezone, phone, plan, onboarded_at, stripe_account_id, stripe_charges_enabled, settings)
    values (${T}, 'Maple Ridge Tree Co. (DEMO)', ${SLUG}, 'OH', 'America/New_York', '+13305550100', 'pro', now(), ${`acct_mock_${T.slice(0, 8)}`}, true, ${sql.json({ min_job_cents: 30000, default_deposit_pct: 25 } as never)})`;
  const kent = randomUUID();
  const akron = randomUUID();
  await sql`insert into branches (id, tenant_id, name, address, lat, lon) values (${kent}, ${T}, 'Kent', '100 Demo Yard Rd, Kent, OH', 41.1537, -81.3579), (${akron}, ${T}, 'Akron', '200 Demo Depot Ave, Akron, OH', 41.0814, -81.519)`;
  await sql`insert into memberships (tenant_id, user_id, role, branch_id) values (${T}, ${owner}, 'owner', ${kent}), (${T}, ${sales}, 'sales_arborist', ${kent}), (${T}, ${office}, 'office', ${kent})`;
  await sql`insert into hospitals (tenant_id, branch_id, name, address, phone) values
    (${T}, ${kent}, 'Demo General Hospital (fictional)', '1 Demo Health Way, Kent, OH', '+13305550190'),
    (${T}, ${akron}, 'Demo City Medical Center (fictional)', '2 Demo Care Blvd, Akron, OH', '+13305550191')`;

  // Crews and workers: levels 1 to 3, two who prefer Spanish.
  const names: [string, number, 'en' | 'es', string | null][] = [
    ['Dana Brooks (DEMO)', 3, 'en', '+13305550111'], ['Luis Ortega (DEMO)', 2, 'es', '+13305550112'], ['Sam Kowalski (DEMO)', 1, 'en', null],
    ['Rae Whitfield (DEMO)', 2, 'en', '+13305550114'], ['Marco Ruiz (DEMO)', 1, 'es', null], ['Jen Patel (DEMO)', 1, 'en', null],
    ['Chris Novak (DEMO)', 3, 'en', '+13305550117'], ['Ty Harmon (DEMO)', 1, 'en', null], ['Alex Greer (DEMO)', 2, 'en', null],
  ];
  const workers: string[] = [];
  for (const [n, lvl, loc, ph] of names) {
    const [w] = await sql`insert into workers (tenant_id, branch_id, full_name, phone, locale, electrical_level, hourly_cost_cents, applicator_license_no, applicator_license_state)
      values (${T}, ${kent}, ${n}, ${ph}, ${loc}, ${lvl}, ${3200 + lvl * 400}, ${lvl === 3 ? `DEMO-LIC-${workers.length + 1}` : null}, ${lvl === 3 ? 'OH' : null}) returning id`;
    workers.push(w!.id);
    if (ph) await sql`insert into consents (tenant_id, phone, status, source) values (${T}, ${ph}, 'opted_in', 'demo seed')`;
  }
  const crews: string[] = [];
  for (const [i, name] of ['Crew A (climb)', 'Crew B (bucket)', 'Crew C (grind/PHC)'].entries()) {
    const [c] = await sql`insert into crews (tenant_id, branch_id, name, leader_worker_id) values (${T}, ${i === 2 ? akron : kent}, ${name}, ${workers[i * 3]!}) returning id`;
    crews.push(c!.id);
    for (const w of workers.slice(i * 3, i * 3 + 3)) await sql`insert into crew_members (tenant_id, crew_id, worker_id) values (${T}, ${c!.id}, ${w})`;
  }
  const equip: Record<string, string> = {};
  for (const [name, type, meter, every, last] of [
    ['Crane 1 (40 t)', 'crane', 2210, 250, 2000], ['Bucket 1', 'bucket', 5120, 250, 4900], ['Bucket 2', 'bucket', 880, 250, 750], ['Chipper 1', 'chipper', 1430, 100, 1400],
    ['Chipper 2', 'chipper', 610, 100, 520], ['Grinder 1', 'grinder', 940, 50, 900], ['Mini loader', 'mini_loader', 1250, 100, 1200], ['Chip truck', 'chip_truck', 30110, 500, 30000],
  ] as const) {
    const [e] = await sql`insert into equipment (tenant_id, branch_id, name, type, hour_meter, service_every_hours, last_service_hours) values (${T}, ${kent}, ${name}, ${type}, ${meter}, ${every}, ${last}) returning id`;
    equip[name] = e!.id;
  }
  await sql`insert into certificates (tenant_id, holder, kind, insurer, policy_no, expires_on) values
    (${T}, 'Maple Ridge Tree Co. (DEMO)', 'gl', 'Demo Mutual (fictional)', 'DEMO-GL-1', ${day(200)}),
    (${T}, 'Maple Ridge Tree Co. (DEMO)', 'wc', 'Demo Mutual (fictional)', 'DEMO-WC-1', ${day(20)}),
    (${T}, 'Ace Crane Rental (DEMO sub)', 'gl', 'Demo Casualty (fictional)', 'DEMO-GL-9', ${day(-5)})`;
  const products: string[] = [];
  for (const [n, epa, rup] of [['DEMO Borer Shield', 'DEMO-1001', false], ['DEMO Leaf Guard', 'DEMO-1002', false], ['DEMO Restricted Concentrate', 'DEMO-1003', true]] as const) {
    const [p] = await sql`insert into products (tenant_id, name, epa_reg_no, is_rup, signal_word, rei_hours, default_unit) values (${T}, ${n}, ${epa}, ${rup}, ${rup ? 'warning' : 'caution'}, ${rup ? 24 : 4}, 'fl_oz') returning id`;
    products.push(p!.id);
  }

  // Customers and properties: 20 customers, 25 properties, around Kent and Akron.
  const streets = ['Elm Hollow Dr', 'Birch Point Ln', 'Cedar Glen Ct', 'Oak Ridge Rd', 'Willow Bend Way', 'Aspen Trail', 'Hickory Run', 'Sycamore Ave', 'Linden Pl', 'Magnolia St'];
  const people = ['Pat Holloway', 'Jordan Reyes', 'Morgan Ellis', 'Casey Lindqvist', 'Riley Okafor', 'Avery Duarte', 'Quinn Albright', 'Jamie Castellano', 'Drew Fitzgerald', 'Taylor Nakamura',
    'Skyler Branson', 'Robin Achebe', 'Cameron Velasquez', 'Hayden Moreau', 'Reese Kowal', 'Parker Sato', 'Emerson Vale', 'Rowan Delgado', 'Sage Whitaker', 'Blair Ivanova'];
  const props: { id: string; customer: string; lat: number; lon: number; city: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const kind = i % 7 === 0 ? 'hoa' : i % 5 === 0 ? 'commercial' : 'residential';
    const phone = `+1330555${String(200 + i).padStart(4, '0')}`;
    const [c] = await sql`insert into customers (tenant_id, branch_id, kind, name, phone, locale, billing_terms_days) values (${T}, ${kent}, ${kind}, ${`${people[i]} (DEMO)`}, ${phone}, ${i % 6 === 3 ? 'es' : 'en'}, ${kind === 'residential' ? 0 : 30}) returning id`;
    if (i % 3 !== 2) await sql`insert into consents (tenant_id, phone, status, source) values (${T}, ${phone}, 'opted_in', 'demo seed')`;
    const count = i < 5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const inKent = (i + k) % 2 === 0;
      const lat = (inKent ? 41.15 : 41.08) + ((i * 7 + k * 3) % 20) / 1000;
      const lon = (inKent ? -81.36 : -81.52) - ((i * 11 + k * 5) % 20) / 1000;
      const [p] = await sql`insert into properties (tenant_id, customer_id, address, city, state_code, lat, lon, hoa_name, access_notes, gate_code, hazards)
        values (${T}, ${c!.id}, ${`${100 + i * 10 + k} ${streets[(i + k) % streets.length]} (DEMO)`}, ${inKent ? 'Kent' : 'Akron'}, 'OH', ${lat}, ${lon}, ${kind === 'hoa' ? 'Maple Glen HOA (DEMO)' : null},
          ${i % 4 === 0 ? 'Back gate on the left side. Dog in yard; customer will bring him in.' : null}, ${i % 4 === 0 ? '4821' : null}, ${sql.json((i % 3 === 0 ? ['Septic field in back yard', 'Soft lawn after rain'] : []) as never)}) returning id`;
      props.push({ id: p!.id, customer: c!.id, lat, lon, city: inKent ? 'Kent' : 'Akron' });
    }
  }

  // Trees: 60, two or three per property.
  const species = [['Silver maple', 'Acer saccharinum', 26], ['Red oak', 'Quercus rubra', 30], ['Green ash', 'Fraxinus pennsylvanica', 18], ['Eastern white pine', 'Pinus strobus', 20], ['Callery pear', 'Pyrus calleryana', 14], ['Norway spruce', 'Picea abies', 16]] as const;
  const trees = new Map<string, { id: string; number: number; label: string; dbh: number }[]>();
  let n = 0;
  for (const [pi, p] of props.entries()) {
    const list: { id: string; number: number; label: string; dbh: number }[] = [];
    const count = pi < 10 ? 3 : 2;
    for (let k = 1; k <= count && n < 60; k++, n++) {
      const [common, latin, dbh0] = species[n % species.length]!;
      const dbh = dbh0 + (n % 5) * 2;
      const near = n % 9 === 0 ? 'service_le_750v' : n % 17 === 0 ? 'dist_le_35kv' : 'none';
      const [t] = await sql`insert into trees (tenant_id, property_id, number, label, species_common, species_latin, dbh_in, height_ft, lat, lon, condition, near_lines)
        values (${T}, ${p.id}, ${k}, ${`Tree ${k}`}, ${common}, ${latin}, ${dbh}, ${40 + (n % 6) * 8}, ${p.lat + k * 0.00008}, ${p.lon + k * 0.00006}, ${n % 4 === 0 ? 'dead' : n % 3 === 0 ? 'poor' : 'fair'}, ${near}) returning id`;
      list.push({ id: t!.id, number: k, label: `Tree ${k}`, dbh });
    }
    trees.set(p.id, list);
  }

  // Estimates in every status; approved ones become jobs.
  const est = async (pi: number, status: 'draft' | 'sent' | 'approved' | 'declined' | 'expired', opts: { crane?: boolean; grind?: boolean; prune?: boolean } = {}) => {
    const p = props[pi]!;
    const ts = trees.get(p.id)!;
    const [num] = await sql`select app.next_number(${T}, 'estimate') as n`;
    const [e] = await sql`insert into estimates (tenant_id, property_id, sales_user_id, number, status, valid_until, deposit_pct, sent_at, approved_at, declined_at, notes)
      values (${T}, ${p.id}, ${sales}, ${num!.n}, ${status}, ${status === 'expired' ? day(-3) : day(25)}, 25,
        ${status === 'draft' ? null : new Date(Date.now() - 6 * 86_400_000)}, ${status === 'approved' ? new Date(Date.now() - 4 * 86_400_000) : null}, ${status === 'declined' ? new Date() : null},
        'Lines and trees as walked with the customer.') returning id`;
    const base = randomUUID();
    await sql`insert into estimate_options (id, tenant_id, estimate_id, name, required, selected, sort) values (${base}, ${T}, ${e!.id}, 'Tree work', true, true, 0)`;
    let total = 0;
    let sort = 0;
    const addLine = async (opt: string, kind: string, desc: string, qty: number, unit: string, cents: number, tree: string | null, hrs: number | null, equipType: string | null = null) => {
      await sql`insert into estimate_lines (tenant_id, option_id, tree_id, kind, description, qty, unit, unit_price_cents, est_crew_hours, equipment_type, sort)
        values (${T}, ${opt}, ${tree}, ${kind}, ${desc}, ${qty}, ${unit}, ${cents}, ${hrs}, ${equipType}, ${sort++})`;
      return Math.round(qty * cents);
    };
    total += await addLine(base, 'remove', `Remove ${ts[0]!.label} (${ts[0]!.dbh} in), haul wood`, 1, 'each', 145000, ts[0]!.id, 10);
    if (opts.prune !== false && ts[1]) total += await addLine(base, 'prune', `Crown clean ${ts[1]!.label}, deadwood over 2 in`, 1, 'each', 65000, ts[1]!.id, 4);
    if (opts.crane) total += await addLine(base, 'crane', '40 t crane, 4 hours', 4, 'hour', 23000, null, null, 'crane');
    total += await addLine(base, 'disposal', 'Chips and brush hauled', 1, 'lump', 15000, null, null);
    if (opts.grind !== false) {
      const g = randomUUID();
      await sql`insert into estimate_options (id, tenant_id, estimate_id, name, required, selected, sort) values (${g}, ${T}, ${e!.id}, 'Grind the stump', false, ${status === 'approved'}, 1)`;
      const grind = await addLine(g, 'stump_grind', `Grind ${ts[0]!.label} stump 6 in below grade`, 1, 'each', 35000, ts[0]!.id, 2, 'grinder');
      if (status === 'approved') total += grind;
    }
    await sql`update estimates set total_cents = ${total} where id = ${e!.id}`;
    // A marked photo per tree on the estimate.
    for (const [k, t] of ts.entries()) {
      const clientId = randomUUID();
      const up = await upload(T, p.id, clientId, pi * 10 + k);
      const [ph] = await sql`insert into photos (tenant_id, property_id, estimate_id, tree_id, kind, storage_path, sha256, taken_at, lat, lon, client_id)
        values (${T}, ${p.id}, ${e!.id}, ${t.id}, 'estimate', ${up.path}, ${up.sha256}, ${new Date(Date.now() - 7 * 86_400_000)}, ${p.lat}, ${p.lon}, ${clientId}) returning id`;
      const cx = 0.3 + (((pi * 10 + k) * 37) % 40) / 100;
      await sql`insert into photo_markups (tenant_id, photo_id, tree_id, shape, color, number) values (${T}, ${ph!.id}, ${t.id}, ${sql.json({ circle: { cx, cy: 0.38, r: 0.3 }, arrow: null, label: [Math.min(0.92, cx + 0.2), 0.12] } as never)}, '#f97316', ${t.number})`;
    }
    if (status === 'approved' || status === 'sent') {
      await sql`insert into signatures (tenant_id, subject_type, subject_id, signer_name, signer_role, image_path, sha256, signed_at, client_id)
        select ${T}, 'estimate', ${e!.id}, ${'Customer (DEMO)'}, 'customer', 'demo/none.png', ${sha(new Uint8Array([pi]))}, now() - interval '4 days', ${randomUUID()} where ${status === 'approved'}`;
    }
    return { estimateId: e!.id as string, property: p, trees: ts, total };
  };

  for (const [pi, status] of [[20, 'draft'], [21, 'draft'], [22, 'sent'], [23, 'sent'], [24, 'declined'], [19, 'expired']] as const) await est(pi, status);

  const job = async (pi: number, opts: { crane?: boolean; checks?: [string, string][]; level?: number } = {}) => {
    const e = await est(pi, 'approved', { crane: opts.crane });
    const [num] = await sql`select app.next_number(${T}, 'job') as n`;
    const [j] = await sql`insert into jobs (tenant_id, estimate_id, property_id, branch_id, number, status, required_electrical_level, needs_crane)
      values (${T}, ${e.estimateId}, ${e.property.id}, ${kent}, ${num!.n}, 'unscheduled', ${opts.level ?? 1}, ${Boolean(opts.crane)}) returning id`;
    for (const [kind, status] of opts.checks ?? [['811', 'cleared']]) {
      await sql`insert into prework_checks (tenant_id, job_id, kind, status, ref_no, reason, valid_until)
        values (${T}, ${j!.id}, ${kind}, ${status}, ${status === 'cleared' ? `DEMO-${kind}-${num!.n}` : null}, 'From the job’s lines (demo).', ${status === 'cleared' ? new Date(Date.now() + 10 * 86_400_000) : null})`;
    }
    const [d] = await sql`insert into deposits (tenant_id, estimate_id, amount_cents, status) values (${T}, ${e.estimateId}, ${Math.round(e.total * 0.25)}, 'pending') returning id`;
    return { ...e, jobId: j!.id as string, number: num!.n as number, depositId: d!.id as string };
  };
  const schedule = async (j: { jobId: string }, crew: number, offset: number, equipment: string[], hours = 8) => {
    const [jd] = await sql`insert into job_days (tenant_id, job_id, crew_id, day, start_time, est_hours) values (${T}, ${j.jobId}, ${crews[crew]!}, ${day(offset)}, '07:30', ${hours}) returning id`;
    for (const eq of equipment) {
      await sql`insert into equipment_bookings (tenant_id, equipment_id, job_day_id, during) values (${T}, ${equip[eq]!}, ${jd!.id},
        tstzrange((${day(offset)}::date + time '07:30') at time zone 'America/New_York', (${day(offset)}::date + time '07:30') at time zone 'America/New_York' + make_interval(hours => ${hours})))`;
    }
    await sql`update jobs set status = 'scheduled' where id = ${j.jobId} and status = 'unscheduled'`;
    return jd!.id as string;
  };

  // 10 jobs.
  const jToday = await job(0, { crane: true, level: 2 });
  const jdToday = await schedule(jToday, 0, 0, ['Crane 1 (40 t)', 'Chipper 1']);
  const jTomorrow = await job(1);
  await schedule(jTomorrow, 1, 1, ['Bucket 1', 'Chipper 2']);
  const jOpen811 = await job(2, { checks: [['811', 'needed'], ['hoa', 'requested']] });
  const jCraneClash = await job(3, { crane: true });
  void jCraneClash; // Wants the crane on the day it's already booked (today): scheduling it there shows the clash.
  await schedule(await job(4), 2, 2, ['Grinder 1']);
  await schedule(await job(5), 1, 3, ['Bucket 2']);
  await job(6);
  // Done jobs with full field records: one billed and paid, one ready to close.
  const jDone = await job(7);
  const jPaid = await job(8);
  const jDraft = await job(9);
  void jDraft;
  for (const [j, offset] of [[jDone, -2], [jPaid, -6]] as const) {
    const jd = await schedule(j, 0, offset, ['Chipper 1']);
    const at = (h: number) => new Date(`${day(offset)}T${String(11 + h).padStart(2, '0')}:30:00Z`);
    const bClient = randomUUID();
    const [b] = await sql`insert into briefings (tenant_id, job_day_id, leader_worker_id, hazards, line_proximity, hospital_name, hospital_address, emergency_address, rescue_plan, completed_at, client_id)
      values (${T}, ${jd}, ${workers[0]!}, ${sql.json(['drop_zone', 'structures', 'weather', 'lines', 'rescue'] as never)}, 'none', 'Demo General Hospital (fictional)', '1 Demo Health Way, Kent, OH', ${j.property.city},
        'Second climber on the ground with a rescue kit; bucket truck on standby.', ${at(0)}, ${bClient}) returning id`;
    for (const [i, w] of workers.slice(0, 3).entries()) {
      await sql`insert into briefing_signoffs (tenant_id, briefing_id, worker_id, signed_at, client_id, late_arrival) values (${T}, ${b!.id}, ${w}, ${at(0)}, ${randomUUID()}, ${i === 2})`;
      await sql`insert into work_log (tenant_id, job_day_id, worker_id, kind, at, client_id) values (${T}, ${jd}, ${w}, 'arrive', ${at(0)}, ${randomUUID()}), (${T}, ${jd}, ${w}, 'leave', ${at(5 + i)}, ${randomUUID()})`;
    }
    await sql`insert into work_log (tenant_id, job_day_id, equipment_id, kind, at, value, client_id) values (${T}, ${jd}, ${equip['Chipper 1']!}, 'equipment_hours', ${at(6)}, 4.5, ${randomUUID()})`;
    const lines = await sql`select l.* from estimate_lines l join estimate_options o on o.id = l.option_id where o.estimate_id = ${j.estimateId} and l.tree_id is not null and (o.required or o.selected)`;
    for (const [k, l] of lines.entries()) {
      const before = randomUUID();
      const after = randomUUID();
      for (const [cid, kind, s] of [[before, 'before', 1], [after, 'after', 2]] as const) {
        const up = await upload(T, j.property.id, cid, 100 + k * 3 + s);
        await sql`insert into photos (tenant_id, property_id, job_day_id, tree_id, kind, storage_path, sha256, taken_at, lat, lon, client_id)
          values (${T}, ${j.property.id}, ${jd}, ${l.tree_id}, ${kind}, ${up.path}, ${up.sha256}, ${at(1 + k)}, ${j.property.lat}, ${j.property.lon}, ${cid})`;
      }
      const [bp] = await sql`select id from photos where client_id = ${before}`;
      const [ap] = await sql`select id from photos where client_id = ${after}`;
      await sql`insert into tree_confirmations (tenant_id, job_day_id, tree_id, line_id, result, before_photo_id, after_photo_id, confirmed_by, at, lat, lon, client_id)
        values (${T}, ${jd}, ${l.tree_id}, ${l.id}, 'done', ${bp!.id}, ${ap!.id}, ${workers[0]!}, ${at(2 + k)}, ${j.property.lat}, ${j.property.lon}, ${randomUUID()})`;
    }
    await sql`insert into disposal_tickets (tenant_id, job_day_id, kind, site, loads, cost_cents, client_id) values (${T}, ${jd}, 'chips', 'Demo Compost Yard (fictional)', 2, 9000, ${randomUUID()})`;
    await sql`update job_days set status = 'closed' where id = ${jd}`;
    await sql`update jobs set status = 'in_progress' where id = ${j.jobId}`;
    await sql`insert into payments (tenant_id, deposit_id, amount_cents, fee_cents, method, stripe_ref, received_at) select ${T}, ${j.depositId}, amount_cents, 0, 'card', ${`cs_demo_${j.depositId.slice(0, 8)}`}, now() - interval '3 days' from deposits where id = ${j.depositId}`;
    await sql`update deposits set status = 'paid' where id = ${j.depositId}`;
  }
  // A signed change order on the done job, an unsigned one left for the office.
  await sql`insert into change_orders (tenant_id, job_id, description, amount_cents, status, client_id) values (${T}, ${jDone.jobId}, 'Raise canopy over driveway (DEMO)', 18000, 'proposed', ${randomUUID()})`;

  // Paid job: invoice and payment.
  const [inum] = await sql`select app.next_number(${T}, 'invoice') as n`;
  const [inv] = await sql`insert into invoices (tenant_id, job_id, number, status, subtotal_cents, deposit_applied_cents, total_cents, flags, sent_at, paid_at)
    values (${T}, ${jPaid.jobId}, ${String(inum!.n)}, 'paid', ${jPaid.total}, ${Math.round(jPaid.total * 0.25)}, ${jPaid.total - Math.round(jPaid.total * 0.25)}, '[]', now() - interval '4 days', now() - interval '2 days') returning id`;
  await sql`insert into invoice_lines (tenant_id, invoice_id, source, description, amount_cents) values (${T}, ${inv!.id}, 'adjustment', 'Work as estimated (DEMO)', ${jPaid.total})`;
  await sql`insert into payments (tenant_id, invoice_id, amount_cents, fee_cents, method, stripe_ref, received_at) values (${T}, ${inv!.id}, ${jPaid.total - Math.round(jPaid.total * 0.25)}, 0, 'check', ${`manual:${inv!.id}:DEMO-CHK-1042`}, now() - interval '2 days')`;
  await sql`update jobs set status = 'billed', closed_at = now() - interval '4 days' where id = ${jPaid.jobId}`;

  // Storm with 8 calls.
  const [storm] = await sql`insert into storm_events (tenant_id, branch_id, name, started_on) values (${T}, ${kent}, 'Wind storm (DEMO)', ${day(-1)}) returning id`;
  const calls: [string, boolean, boolean, boolean, boolean][] = [
    ['Oak on garage roof', true, false, false, false], ['Limb across driveway', false, true, false, false], ['Tree leaning on service wire', false, false, true, false], ['Small limb in yard', false, false, false, false],
    ['Maple split, hanging over deck', true, false, false, false], ['Pine down on fence', false, true, false, false], ['Branch hit a person walking, minor cut', false, false, false, true], ['Tree blocking HOA road', false, true, false, false],
  ];
  for (const [i, [note, structure, blocking, lines, injury]] of calls.entries()) {
    await sql`insert into storm_intake (tenant_id, storm_event_id, caller_name, phone, address, on_structure, blocking_access, lines_involved, injury, notes, status, created_at)
      values (${T}, ${storm!.id}, ${`Caller ${i + 1} (DEMO)`}, ${`+1330555${String(900 + i).padStart(4, '0')}`}, ${`${300 + i * 4} Storm Demo Rd, Kent, OH`}, ${structure}, ${blocking}, ${lines}, ${injury}, ${note}, ${lines ? 'utility' : 'new'}, now() - make_interval(mins => ${(8 - i) * 17}))`;
  }

  // Plant health care: one program, 6 applications.
  const [prog] = await sql`insert into phc_programs (tenant_id, property_id, year, status) values (${T}, ${props[10]!.id}, ${new Date().getUTCFullYear()}, 'active') returning id`;
  for (let i = 0; i < 6; i++) {
    const p = props[10 + (i % 3)]!;
    const productIdx = i % 3;
    const [prod] = await sql`select * from products where id = ${products[productIdx]!}`;
    const id = randomUUID();
    await sql`insert into phc_applications (id, tenant_id, program_id, property_id, applicator_worker_id, applicator_license_no, product_id, product_name, epa_reg_no, is_rup, target_pest, site_desc, method, concentration,
        total_amount, amount_unit, area_treated, applied_on, start_time, end_time, wind_mph, temp_f, state_code, client_id)
      values (${id}, ${T}, ${i < 2 ? prog!.id : null}, ${p.id}, ${workers[0]!}, 'DEMO-LIC-1', ${prod!.id}, ${prod!.name}, ${prod!.epa_reg_no}, ${prod!.is_rup}, ${i % 2 ? 'Emerald ash borer' : 'Leaf scorch'},
        ${'Front yard trees (DEMO)'}, 'Soil injection', '1 fl oz per gal', ${8 + i}, 'gal', '2 trees', ${day(-(i * 5 + 1))}, '09:00', '09:40', 4, 68, 'OH', ${randomUUID()})`;
  }

  // A claim on the done job.
  const claimId = randomUUID();
  await sql`insert into claims (id, viewer_token_hash, tenant_id, job_id, opened_on, kind, description) values (${claimId}, ${hashToken(derivedToken('claim', claimId))}, ${T}, ${jDone.jobId}, ${day(-1)}, 'property_damage', 'Customer reports a rut in the side lawn from the chipper (DEMO).')`;

  console.log(`Seeded Maple Ridge Tree Co. (DEMO). Sign in at /login with "Use the demo company", or ${DEMO.email} / ${DEMO.password}.`);
  console.log(`Today's crew day: job ${jToday.number} (${jdToday}). Open /dev for crew and customer links.`);
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
