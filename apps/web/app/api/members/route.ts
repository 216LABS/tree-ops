import { createClient } from '@supabase/supabase-js';
import { db } from '@treeops/db';
import { z } from 'zod';
import { requireApi } from '@/lib/auth';
import { fail, isUuid, parseJson, route } from '@/lib/http';

const body = z.object({ email: z.email(), role: z.enum(['owner', 'office', 'sales_arborist', 'crew_leader', 'crew_member', 'sub', 'enterprise_admin']), password: z.string().min(10).max(100), branchId: z.uuid().nullish() });

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }).auth.admin;

/**
 * Adds someone who signs in (office, sales arborist, enterprise admin). The owner sets a first password and passes it on;
 * nothing is emailed. Enterprise tenants sign in with SSO instead. Crew don't need accounts: they use the day's link.
 */
export const POST = route(async (req) => {
  const ctx = await requireApi(['owner', 'enterprise_admin']);
  const b = await parseJson(req, body);
  const created = await admin().createUser({ email: b.email.toLowerCase(), password: b.password, email_confirm: true });
  let userId = created.data.user?.id;
  if (!userId) {
    const [u] = await db()`select id from auth.users where lower(email) = ${b.email.toLowerCase()}`;
    if (!u) fail('validation', created.error?.message ?? 'Could not add that person.');
    userId = u!.id;
  }
  const [m] = await db()`insert into memberships (tenant_id, user_id, role, branch_id) values (${ctx.tenantId}, ${userId!}, ${b.role}, ${b.branchId ?? null})
    on conflict (tenant_id, user_id) do update set role = excluded.role, branch_id = excluded.branch_id returning id`;
  await db()`insert into audit_log (tenant_id, actor_id, action, target_table, target_id, after) values (${ctx.tenantId}, ${ctx.userId}, 'member_added', 'memberships', ${m!.id}, ${db().json({ email: b.email, role: b.role } as never)})`;
  return { id: m!.id };
});

export const DELETE = route(async (req) => {
  const ctx = await requireApi(['owner', 'enterprise_admin']);
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!isUuid(id)) fail('validation', 'Bad id.');
  const [m] = await db()`select user_id, role from memberships where id = ${id} and tenant_id = ${ctx.tenantId}`;
  if (!m) fail('not_found', 'Not found.');
  if (m!.user_id === ctx.userId) fail('conflict', 'You can’t remove yourself.');
  await db()`delete from memberships where id = ${id} and tenant_id = ${ctx.tenantId}`;
  return { ok: true };
});
