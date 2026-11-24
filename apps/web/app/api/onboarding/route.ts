import { db } from '@treeops/db';
import { toE164 } from '@treeops/core/messages';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { parseCustomerCsv } from '@/lib/csv';
import { fail, parseJson, route } from '@/lib/http';

const body = z.object({
  company: z.string().trim().min(2).max(200),
  phone: z.string().max(30).nullish(),
  stateCode: z.string().length(2),
  timezone: z.string().max(60).default('America/New_York'),
  branch: z.string().trim().min(1).max(120).default('Main'),
  branchAddress: z.string().max(300).nullish(),
  crew: z.object({ name: z.string().trim().min(1).max(80), leader: z.string().trim().min(1).max(120), leaderPhone: z.string().max(30).nullish(), members: z.array(z.string().trim().min(1).max(120)).max(10).default([]) }).nullish(),
  equipment: z.array(z.object({ name: z.string().trim().min(1).max(80), type: z.enum(['chipper', 'grinder', 'bucket', 'crane', 'mini_loader', 'log_truck', 'mats', 'chip_truck', 'spray_rig', 'other']) })).max(30).default([]),
  hospital: z.object({ name: z.string().trim().min(1).max(200), address: z.string().trim().min(3).max(300) }).nullish(),
  customersCsv: z.string().max(500_000).nullish(),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'company';

/** New company in one pass (docs/SPEC.md screen 13): company, branch, crew, equipment, hospital, customers. */
export const POST = route(async (req) => {
  const user = await currentUser();
  if (!user) fail('unauthorized', 'Sign in first.');
  const b = await parseJson(req, body);
  const sql = db();
  const [existing] = await sql`select tenant_id from memberships where user_id = ${user!.id}`;
  if (existing) fail('conflict', 'This account already has a company.');
  const csv = b.customersCsv ? parseCustomerCsv(b.customersCsv) : { rows: [], skipped: 0 };
  return sql.begin(async (tx) => {
    let slug = slugify(b.company);
    if ((await tx`select 1 from tenants where slug = ${slug}`).length) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
    const [t] = await tx`insert into tenants (name, slug, state_code, timezone, phone, onboarded_at) values (${b.company}, ${slug}, ${b.stateCode.toUpperCase()}, ${b.timezone}, ${b.phone ? (toE164(b.phone) ?? b.phone) : null}, now()) returning id`;
    const tenantId = t!.id as string;
    const [br] = await tx`insert into branches (tenant_id, name, timezone, address) values (${tenantId}, ${b.branch}, ${b.timezone}, ${b.branchAddress ?? null}) returning id`;
    await tx`insert into memberships (tenant_id, user_id, role, branch_id) values (${tenantId}, ${user!.id}, 'owner', ${br!.id})`;
    if (b.crew) {
      const [leader] = await tx`insert into workers (tenant_id, branch_id, full_name, phone, electrical_level) values (${tenantId}, ${br!.id}, ${b.crew.leader}, ${b.crew.leaderPhone ? (toE164(b.crew.leaderPhone) ?? b.crew.leaderPhone) : null}, 1) returning id`;
      const [crew] = await tx`insert into crews (tenant_id, branch_id, name, leader_worker_id) values (${tenantId}, ${br!.id}, ${b.crew.name}, ${leader!.id}) returning id`;
      await tx`insert into crew_members (tenant_id, crew_id, worker_id) values (${tenantId}, ${crew!.id}, ${leader!.id})`;
      for (const m of b.crew.members) {
        const [w] = await tx`insert into workers (tenant_id, branch_id, full_name) values (${tenantId}, ${br!.id}, ${m}) returning id`;
        await tx`insert into crew_members (tenant_id, crew_id, worker_id) values (${tenantId}, ${crew!.id}, ${w!.id})`;
      }
    }
    for (const e of b.equipment) await tx`insert into equipment (tenant_id, branch_id, name, type) values (${tenantId}, ${br!.id}, ${e.name}, ${e.type})`;
    if (b.hospital) await tx`insert into hospitals (tenant_id, branch_id, name, address) values (${tenantId}, ${br!.id}, ${b.hospital.name}, ${b.hospital.address})`;
    for (const c of csv.rows) {
      const [cu] = await tx`insert into customers (tenant_id, branch_id, name, phone) values (${tenantId}, ${br!.id}, ${c.name}, ${c.phone ? (toE164(c.phone) ?? c.phone) : null}) returning id`;
      await tx`insert into properties (tenant_id, customer_id, address, city, state_code) values (${tenantId}, ${cu!.id}, ${c.address}, ${c.city}, ${c.state})`;
    }
    return { tenantId, customers: csv.rows.length, skipped: csv.skipped };
  });
});
