import { toE164 } from '@treeops/core/messages';
import { z } from 'zod';
import type { P } from '@/lib/api';
import { asUser, requireApi, type Role } from '@/lib/auth';
import { fail, idempotent, isUuid, parseJson, route } from '@/lib/http';
import { recordConsent } from '@/lib/messaging';

/**
 * Simple settings lists (crews, workers, equipment, hospitals, products, certificates, branches, own pre-work rules,
 * species): one route, a schema per table, RLS deciding who may write. Columns are whitelisted by the schema.
 */
const phone = z.string().max(30).nullish().transform((v) => (v ? (toE164(v) ?? v) : null));
const TABLES: Record<string, { roles: Role[]; schema: z.ZodObject<z.ZodRawShape> }> = {
  workers: { roles: ['owner', 'office', 'enterprise_admin'], schema: z.object({ full_name: z.string().trim().min(1).max(120), phone, locale: z.enum(['en', 'es']).default('en'), kind: z.enum(['employee', 'sub']).default('employee'), electrical_level: z.number().int().min(1).max(4).default(1), isa_cert_no: z.string().max(40).nullish(), applicator_license_no: z.string().max(40).nullish(), applicator_license_state: z.string().length(2).nullish(), hourly_cost_cents: z.number().int().min(0).max(100000).nullish(), branch_id: z.uuid().nullish(), active: z.boolean().default(true) }) },
  crews: { roles: ['owner', 'office'], schema: z.object({ name: z.string().trim().min(1).max(80), leader_worker_id: z.uuid().nullish(), branch_id: z.uuid().nullish(), active: z.boolean().default(true) }) },
  crew_members: { roles: ['owner', 'office'], schema: z.object({ crew_id: z.uuid(), worker_id: z.uuid() }) },
  equipment: { roles: ['owner', 'office'], schema: z.object({ name: z.string().trim().min(1).max(80), type: z.enum(['chipper', 'grinder', 'bucket', 'crane', 'mini_loader', 'log_truck', 'mats', 'chip_truck', 'spray_rig', 'other']), hour_meter: z.number().min(0).max(1e6).nullish(), service_every_hours: z.number().min(0).max(1e5).nullish(), last_service_hours: z.number().min(0).max(1e6).nullish(), branch_id: z.uuid().nullish(), active: z.boolean().default(true) }) },
  hospitals: { roles: ['owner', 'office'], schema: z.object({ name: z.string().trim().min(1).max(200), address: z.string().trim().min(3).max(300), phone, branch_id: z.uuid().nullish() }) },
  products: { roles: ['owner', 'office', 'sales_arborist'], schema: z.object({ name: z.string().trim().min(1).max(200), epa_reg_no: z.string().trim().min(1).max(40), is_rup: z.boolean().default(false), signal_word: z.enum(['caution', 'warning', 'danger']).nullish(), rei_hours: z.number().int().min(0).max(1000).nullish(), default_unit: z.string().max(20).default('fl_oz'), active: z.boolean().default(true) }) },
  certificates: { roles: ['owner', 'office'], schema: z.object({ holder: z.string().trim().min(1).max(200), kind: z.enum(['gl', 'wc', 'auto', 'umbrella']), insurer: z.string().max(200).nullish(), policy_no: z.string().max(80).nullish(), expires_on: z.iso.date() }) },
  branches: { roles: ['owner', 'enterprise_admin'], schema: z.object({ name: z.string().trim().min(1).max(120), timezone: z.string().max(60).default('America/New_York'), address: z.string().max(300).nullish(), parent_id: z.uuid().nullish() }) },
  prework_rules: { roles: ['owner', 'office'], schema: z.object({ state_code: z.string().length(2).nullish(), city: z.string().max(100).nullish(), kind: z.enum(['811', 'permit', 'hoa', 'utility_line', 'neighbor', 'other']), trigger: z.object({ line_kinds: z.array(z.string()).optional(), near_lines: z.array(z.string()).optional(), min_dbh_in: z.number().optional(), pine_min_dbh_in: z.number().optional() }), lead_days: z.number().int().min(0).max(90).nullish(), valid_days: z.number().int().min(0).max(365).nullish(), source_note: z.string().trim().min(3).max(600), verified: z.boolean().default(false) }) },
  species: { roles: ['owner', 'office'], schema: z.object({ common_name: z.string().trim().min(1).max(80), latin_name: z.string().max(80).nullish(), is_pine: z.boolean().default(false) }) },
};

const tableOf = async (params: Promise<{ table: string }>) => {
  const { table } = await params;
  const t = TABLES[table];
  if (!t) fail('not_found', 'Unknown list.');
  return { name: table, ...t! };
};

export const POST = route<P<'table'>>(async (req, { params }) => {
  const t = await tableOf(params);
  const ctx = await requireApi(t.roles);
  const b = await parseJson(req, t.schema.extend({ textOk: z.boolean().optional() }));
  const { textOk, ...row } = b as Record<string, unknown>;
  return idempotent(ctx.tenantId, req, `settings.${t.name}.create`, () =>
    asUser(ctx, async (tx) => {
      const cols = Object.keys(row);
      const [r] = await tx`insert into ${tx(t.name)} ${tx({ ...row, tenant_id: ctx.tenantId } as never, [...cols, 'tenant_id'] as never)} returning id`;
      if (t.name === 'workers' && textOk && row.phone) await recordConsent(tx, ctx.tenantId, String(row.phone), 'opted_in', `verbal:office:${ctx.userId}`);
      return { id: r!.id };
    }),
  );
});

export const PATCH = route<P<'table'>>(async (req, { params }) => {
  const t = await tableOf(params);
  const ctx = await requireApi(t.roles);
  const b = await parseJson(req, t.schema.partial().extend({ id: z.uuid() }));
  const { id, ...row } = b as Record<string, unknown> & { id: string };
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  if (!cols.length) fail('validation', 'Nothing to change.');
  return asUser(ctx, async (tx) => {
    const [r] = await tx`update ${tx(t.name)} set ${tx(row as never, cols as never)} where id = ${id} returning id`;
    if (!r) fail('not_found', 'Not found, or your role can’t change it.');
    return { id };
  });
});

export const DELETE = route<P<'table'>>(async (req, { params }) => {
  const t = await tableOf(params);
  const ctx = await requireApi(t.roles);
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!isUuid(id)) fail('validation', 'Bad id.');
  return asUser(ctx, async (tx) => {
    const [r] = await tx`delete from ${tx(t.name)} where id = ${id} returning id`;
    if (!r) fail('not_found', 'Not found, or your role can’t remove it.');
    return { ok: true };
  });
});
