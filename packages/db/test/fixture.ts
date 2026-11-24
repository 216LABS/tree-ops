import { randomUUID } from 'node:crypto';
import type { Q } from '../src/index';

/** A tenant with one row in every tenant table, for isolation tests. Uses the server connection. */
export async function makeTenant(sql: Q, label: string) {
  const id = randomUUID();
  const u = () => randomUUID();
  const users = { owner: u(), office: u(), sales: u(), crew: u(), crewOther: u(), admin: u() };
  for (const [role, uid] of Object.entries(users)) {
    await sql`insert into auth.users (id, email, aud, role, instance_id) values (${uid}, ${`${role}-${uid}@tree.test`}, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`;
  }
  await sql`insert into tenants (id, name, slug, state_code) values (${id}, ${label}, ${`t-${id.slice(0, 8)}`}, 'OH')`;
  const branch = u();
  await sql`insert into branches (id, tenant_id, name) values (${branch}, ${id}, 'Main')`;
  const roles: [string, string][] = [[users.owner, 'owner'], [users.office, 'office'], [users.sales, 'sales_arborist'], [users.crew, 'crew_member'], [users.crewOther, 'crew_member'], [users.admin, 'enterprise_admin']];
  for (const [uid, role] of roles) await sql`insert into memberships (tenant_id, user_id, role) values (${id}, ${uid}, ${role})`;
  const w1 = u(), w2 = u();
  await sql`insert into workers (id, tenant_id, user_id, full_name, electrical_level) values (${w1}, ${id}, ${users.crew}, 'Crew One', 2), (${w2}, ${id}, ${users.crewOther}, 'Crew Two', 1)`;
  const crew1 = u(), crew2 = u();
  await sql`insert into crews (id, tenant_id, name, leader_worker_id) values (${crew1}, ${id}, 'Crew 1', ${w1}), (${crew2}, ${id}, 'Crew 2', ${w2})`;
  await sql`insert into crew_members (tenant_id, crew_id, worker_id) values (${id}, ${crew1}, ${w1}), (${id}, ${crew2}, ${w2})`;
  const equip = u();
  await sql`insert into equipment (id, tenant_id, name, type) values (${equip}, ${id}, 'Crane', 'crane')`;
  await sql`insert into hospitals (tenant_id, name, address) values (${id}, 'General', '1 Main St')`;
  const customer = u();
  await sql`insert into customers (id, tenant_id, name, phone) values (${customer}, ${id}, 'Cust', '+12165550100')`;
  const property = u();
  await sql`insert into properties (id, tenant_id, customer_id, address, state_code, city) values (${property}, ${id}, ${customer}, '1 Oak Ln', 'OH', 'Kent')`;
  const tree = u();
  await sql`insert into trees (id, tenant_id, property_id, number, label, near_lines) values (${tree}, ${id}, ${property}, 1, 'Tree 1', 'none')`;
  await sql`insert into species (tenant_id, common_name) values (${id}, 'Local oak')`;
  const estimate = u();
  await sql`insert into estimates (id, tenant_id, property_id, sales_user_id, number, status) values (${estimate}, ${id}, ${property}, ${users.sales}, 1001, 'approved')`;
  const option = u(), line = u();
  await sql`insert into estimate_options (id, tenant_id, estimate_id, name, required) values (${option}, ${id}, ${estimate}, 'Base', true)`;
  await sql`insert into estimate_lines (id, tenant_id, option_id, tree_id, kind, description, qty, unit, unit_price_cents) values (${line}, ${id}, ${option}, ${tree}, 'remove', 'Remove tree 1', 1, 'each', 100000)`;
  const photo = u();
  await sql`insert into photos (id, tenant_id, property_id, estimate_id, tree_id, kind, storage_path, sha256, taken_at, client_id) values (${photo}, ${id}, ${property}, ${estimate}, ${tree}, 'estimate', 'p', ${'a'.repeat(64)}, now(), ${u()})`;
  await sql`insert into photo_markups (tenant_id, photo_id, tree_id, shape, number) values (${id}, ${photo}, ${tree}, '{}', 1)`;
  const sig = u();
  await sql`insert into signatures (id, tenant_id, subject_type, subject_id, signer_name, image_path, sha256, signed_at, client_id) values (${sig}, ${id}, 'estimate', ${estimate}, 'Cust', 's', ${'b'.repeat(64)}, now(), ${u()})`;
  const deposit = u();
  await sql`insert into deposits (id, tenant_id, estimate_id, amount_cents) values (${deposit}, ${id}, ${estimate}, 1000)`;
  const job = u();
  await sql`insert into jobs (id, tenant_id, estimate_id, property_id, number) values (${job}, ${id}, ${estimate}, ${property}, 1001)`;
  const check = u();
  await sql`insert into prework_checks (id, tenant_id, job_id, kind) values (${check}, ${id}, ${job}, '811')`;
  const day1 = u(), day2 = u();
  await sql`insert into job_days (id, tenant_id, job_id, crew_id, day) values (${day1}, ${id}, ${job}, ${crew1}, '2026-05-04'), (${day2}, ${id}, ${job}, ${crew2}, '2026-05-05')`;
  await sql`insert into equipment_bookings (tenant_id, equipment_id, job_day_id, during) values (${id}, ${equip}, ${day1}, tstzrange('2026-05-04 11:30Z', '2026-05-04 19:30Z'))`;
  await sql`insert into crew_links (tenant_id, job_day_id, token_hash, expires_at) values (${id}, ${day1}, ${randomUUID().replace(/-/g, '').padEnd(64, '0')}, now() + interval '1 day')`;
  const briefing = u();
  await sql`insert into briefings (id, tenant_id, job_day_id, leader_worker_id, hazards, line_proximity, completed_at, client_id) values (${briefing}, ${id}, ${day1}, ${w1}, '[]', 'none', now(), ${u()})`;
  await sql`insert into briefing_signoffs (tenant_id, briefing_id, worker_id, signed_at, client_id) values (${id}, ${briefing}, ${w1}, now(), ${u()})`;
  await sql`insert into work_log (tenant_id, job_day_id, worker_id, kind, at, client_id) values (${id}, ${day1}, ${w1}, 'arrive', now(), ${u()})`;
  const after = u();
  await sql`insert into photos (id, tenant_id, job_day_id, tree_id, kind, storage_path, sha256, taken_at, client_id) values (${after}, ${id}, ${day1}, ${tree}, 'after', 'p2', ${'c'.repeat(64)}, now(), ${u()})`;
  await sql`insert into tree_confirmations (tenant_id, job_day_id, tree_id, line_id, result, after_photo_id, at, client_id) values (${id}, ${day1}, ${tree}, ${line}, 'done', ${after}, now(), ${u()})`;
  await sql`insert into change_orders (tenant_id, job_id, description, amount_cents, client_id) values (${id}, ${job}, 'extra', 500, ${u()})`;
  await sql`insert into corrections (tenant_id, target_table, target_id, field, new_value, reason, by_user) values (${id}, 'work_log', ${u()}, 'at', '"x"', 'typo fix', ${users.owner})`;
  await sql`insert into disposal_tickets (tenant_id, job_day_id, kind, loads, client_id) values (${id}, ${day1}, 'chips', 1, ${u()})`;
  const invoice = u();
  await sql`insert into invoices (id, tenant_id, job_id, number, subtotal_cents, total_cents) values (${invoice}, ${id}, ${job}, '1001', 100000, 100000)`;
  await sql`insert into invoice_lines (tenant_id, invoice_id, source, description, amount_cents) values (${id}, ${invoice}, 'adjustment', 'x', 1)`;
  await sql`insert into payments (tenant_id, invoice_id, amount_cents, method, received_at) values (${id}, ${invoice}, 100, 'check', now())`;
  const product = u();
  await sql`insert into products (id, tenant_id, name, epa_reg_no) values (${product}, ${id}, 'P', ${`DEMO-${id.slice(0, 4)}`})`;
  const program = u();
  await sql`insert into phc_programs (id, tenant_id, property_id, year) values (${program}, ${id}, ${property}, 2026)`;
  await sql`insert into phc_applications (tenant_id, program_id, property_id, applicator_worker_id, applicator_license_no, product_id, product_name, epa_reg_no, site_desc, total_amount, amount_unit, applied_on, state_code, client_id)
    values (${id}, ${program}, ${property}, ${w1}, 'L1', ${product}, 'P', 'DEMO-1', 'yard', 1, 'gal', '2026-05-04', 'OH', ${u()})`;
  const storm = u();
  await sql`insert into storm_events (id, tenant_id, name, started_on) values (${storm}, ${id}, 'Storm', '2026-05-01')`;
  await sql`insert into storm_intake (tenant_id, storm_event_id, address) values (${id}, ${storm}, '2 Elm')`;
  await sql`insert into claims (tenant_id, job_id, opened_on, kind, description) values (${id}, ${job}, '2026-05-06', 'property_damage', 'rut')`;
  await sql`insert into certificates (tenant_id, holder, kind, expires_on) values (${id}, 'Us', 'gl', '2027-01-01')`;
  await sql`insert into proof_packets (tenant_id, job_id, sha256, pdf_path, manifest) values (${id}, ${job}, ${'d'.repeat(64)}, 'x', '{}')`;
  await sql`insert into prework_rules (tenant_id, kind, trigger, source_note) values (${id}, 'other', '{}', 'own rule')`;
  await sql`insert into consents (tenant_id, phone, status, source) values (${id}, '+12165550100', 'opted_in', 'test')`;
  await sql`insert into messages (tenant_id, to_phone, template, body, idem_key) values (${id}, '+12165550100', 'scheduled', 'x', ${u()})`;
  await sql`insert into weather_snapshots (tenant_id, lat, lon, for_date, source, fetched_at, hourly, flags) values (${id}, 41, -81, '2026-05-04', 'mock', now(), '[]', '[]')`;
  return { id, users, branch, workers: { w1, w2 }, crews: { crew1, crew2 }, equip, customer, property, tree, estimate, option, line, photo, job, check, days: { day1, day2 }, invoice, product, storm };
}

/** Every table that carries tenant_id and is reachable by signed-in users. */
export const TENANT_TABLES = [
  'branches', 'memberships', 'workers', 'crews', 'crew_members', 'equipment', 'hospitals', 'customers', 'properties', 'trees', 'species',
  'estimates', 'estimate_options', 'estimate_lines', 'photos', 'photo_markups', 'signatures', 'deposits', 'jobs', 'prework_checks', 'job_days',
  'equipment_bookings', 'crew_links', 'briefings', 'briefing_signoffs', 'work_log', 'tree_confirmations', 'change_orders', 'corrections',
  'disposal_tickets', 'invoices', 'invoice_lines', 'payments', 'products', 'phc_programs', 'phc_applications', 'storm_events', 'storm_intake',
  'claims', 'certificates', 'proof_packets', 'prework_rules', 'consents', 'messages', 'weather_snapshots', 'audit_log',
] as const;
