import { createServerClient } from '@supabase/ssr';
import { db, withUser, type Tx } from '@treeops/db';
import { settingsOf, type TenantSettings } from '@treeops/core/settings';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fail } from './http';

export type Role = 'owner' | 'office' | 'sales_arborist' | 'crew_leader' | 'crew_member' | 'sub' | 'enterprise_admin';
export const OFFICE_ROLES: Role[] = ['owner', 'office', 'sales_arborist', 'enterprise_admin'];
export const MANAGERS: Role[] = ['owner', 'office'];
export const SELLERS: Role[] = ['owner', 'office', 'sales_arborist'];

export interface Tenant {
  id: string; name: string; slug: string; plan: 'free' | 'pro' | 'enterprise'; state_code: string; timezone: string; default_locale: 'en' | 'es';
  phone: string | null; stripe_account_id: string | null; stripe_charges_enabled: boolean; sms_sender: string | null; settings: unknown; sso_domain: string | null; onboarded_at: Date | null;
}
export interface Ctx { userId: string; email: string | null; tenantId: string; role: Role; branchId: string | null; tenant: Tenant; settings: TenantSettings }

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server components can't set cookies; the proxy refreshes the session. */
        }
      },
    },
  });
}

export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function contextFor(user: { id: string; email: string | null }): Promise<Ctx | null> {
  const sql = db();
  const [m] = await sql`select m.tenant_id, m.role, m.branch_id, to_jsonb(t) as tenant from memberships m join tenants t on t.id = m.tenant_id where m.user_id = ${user.id} order by m.created_at limit 1`;
  if (!m) return null;
  const tenant = m.tenant as Tenant;
  return { userId: user.id, email: user.email, tenantId: m.tenant_id, role: m.role, branchId: m.branch_id, tenant, settings: settingsOf(tenant.settings) };
}

/** For pages: signed-out visitors go to login, new users to setup, crew people to a note about their link. */
export async function requirePage(roles: Role[] = OFFICE_ROLES): Promise<Ctx> {
  const user = await currentUser();
  if (!user) redirect('/login');
  const ctx = await contextFor(user);
  if (!ctx) redirect('/onboarding');
  if (!OFFICE_ROLES.includes(ctx.role)) redirect('/crew-note');
  if (!roles.includes(ctx.role)) redirect('/dashboard');
  return ctx;
}

/** For API routes: 401 with no session, 403 when the role can't do this. */
export async function requireApi(roles: Role[] = OFFICE_ROLES): Promise<Ctx> {
  const user = await currentUser();
  if (!user) fail('unauthorized', 'Sign in first.');
  const ctx = await contextFor(user!);
  if (!ctx) fail('forbidden', 'This account has no company yet.');
  if (!roles.includes(ctx!.role)) fail('forbidden', 'Your role can’t do this.');
  return ctx!;
}

/** Runs as the signed-in user, so Postgres RLS decides. Office reads and writes go through this. */
export const asUser = <T>(ctx: Pick<Ctx, 'userId'>, fn: (tx: Tx) => Promise<T>) => withUser(ctx.userId, fn);

export const ROLE_WORDS: Record<Role, string> = {
  owner: 'Owner', office: 'Office', sales_arborist: 'Sales arborist', crew_leader: 'Crew leader', crew_member: 'Crew member', sub: 'Subcontractor', enterprise_admin: 'Enterprise admin',
};
