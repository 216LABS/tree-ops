import { db } from '@treeops/db';
import { prettyPhone } from '@treeops/core/messages';
import { Badge, Card, Eyebrow, PageHeader } from '@treeops/ui';
import Link from 'next/link';
import { asUser, requirePage, ROLE_WORDS } from '@/lib/auth';
import { certState } from '@/lib/certs';
import { fmtDay, fmtTime, todayIn } from '@/lib/format';
import { CompanyForm, CrewMembers, ListBlock, Members, StripeConnect } from './settings-client';

export const metadata = { title: 'Settings' };

const TABS = [['company', 'Company'], ['crew', 'Crews and people'], ['equipment', 'Equipment'], ['safety', 'Hospitals'], ['products', 'Products'], ['certificates', 'Insurance'], ['rules', 'Pre-work rules'], ['branches', 'Branches'], ['logins', 'Sign-ins'], ['export', 'Export'], ['system', 'System']] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; welcome?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'company';
  const today = todayIn(ctx.tenant.timezone);
  const d = await asUser(ctx, async (tx) => ({
    workers: await tx`select * from workers order by active desc, full_name`,
    crews: await tx`select c.*, (select coalesce(json_agg(json_build_object('id', cm.id, 'worker_id', cm.worker_id, 'name', w.full_name)), '[]') from crew_members cm join workers w on w.id = cm.worker_id where cm.crew_id = c.id) as members from crews c order by c.name`,
    equipment: await tx`select * from equipment order by type, name`,
    hospitals: await tx`select * from hospitals order by name`,
    products: await tx`select * from products order by name`,
    certificates: await tx`select * from certificates order by expires_on`,
    rules: await tx`select * from prework_rules order by tenant_id nulls first, state_code nulls first, city nulls first, kind`,
    branches: await tx`select * from branches order by name`,
    members: await tx`select m.id, m.role, m.user_id from memberships m order by m.created_at`,
    failed: await tx`select id, to_phone, template, error, created_at from messages where status = 'failed' order by created_at desc limit 20`,
    blocked: await tx`select count(*)::int as n from messages where status = 'blocked_no_consent' and created_at > now() - interval '30 days'`,
  }));
  const emails = new Map((await db()`select u.id, u.email from auth.users u join memberships m on m.user_id = u.id where m.tenant_id = ${ctx.tenantId}`).map((r) => [r.id as string, r.email as string]));
  const dead = await db()`select kind, last_error, created_at from jobs_queue where status = 'dead' and (tenant_id = ${ctx.tenantId} or tenant_id is null) order by created_at desc limit 20`;
  const workerOpts: [string, string][] = [['', 'None'], ...d.workers.map((w) => [w.id as string, w.full_name as string] as [string, string])];
  const branchOpts: [string, string][] = [['', 'All branches'], ...d.branches.map((b) => [b.id as string, b.name as string] as [string, string])];
  const owner = ['owner', 'enterprise_admin'].includes(ctx.role);

  return (
    <div>
      <PageHeader title="Settings" />
      {sp.welcome ? <p className="mb-4 rounded-control border border-ok-line bg-ok-tint p-3 text-sm text-ok-ink">You’re set up. Check the weather limits below, connect Stripe if you take cards, then add your first customer.</p> : null}
      <nav className="mb-6 flex flex-wrap gap-1">{TABS.map(([k, l]) => <Link key={k} href={`/settings?tab=${k}`} className={`rounded-control px-3 py-2 text-sm ${k === tab ? 'bg-ink text-surface' : 'bg-tint-2'}`}>{l}</Link>)}</nav>

      {tab === 'company' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><Eyebrow>Company</Eyebrow><CompanyForm tenant={{ name: ctx.tenant.name, phone: ctx.tenant.phone, state: ctx.tenant.state_code, tz: ctx.tenant.timezone, sso: ctx.tenant.sso_domain }} settings={ctx.settings} canEdit={owner} /></Card>
          <Card>
            <Eyebrow>Card and bank payments</Eyebrow>
            <p className="mt-2 text-sm">{ctx.tenant.stripe_account_id ? (ctx.tenant.stripe_charges_enabled ? 'Connected. Customers can pay deposits and invoices by card or bank.' : 'Started. Finish Stripe’s questions to take payments.') : 'Not connected. You can still record checks and cash by hand.'}</p>
            <p className="mt-1 text-xs text-muted">Plan: {ctx.tenant.plan}. The platform fee is a small share of each card payment, capped; checks and cash have none.</p>
            {ctx.role === 'owner' ? <StripeConnect started={Boolean(ctx.tenant.stripe_account_id)} /> : null}
          </Card>
        </div>
      ) : null}

      {tab === 'crew' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <Eyebrow className="mb-2">People</Eyebrow>
            <ListBlock table="workers" rows={d.workers} kind="workers" branchOpts={branchOpts} />
          </section>
          <section>
            <Eyebrow className="mb-2">Crews</Eyebrow>
            <ListBlock table="crews" rows={d.crews} kind="crews" workerOpts={workerOpts} branchOpts={branchOpts} />
            <div className="mt-4 space-y-3">{d.crews.map((c) => <CrewMembers key={c.id} crew={{ id: c.id, name: c.name, members: c.members }} workers={d.workers.filter((w) => w.active).map((w) => ({ id: w.id, name: w.full_name }))} />)}</div>
          </section>
        </div>
      ) : null}

      {tab === 'equipment' ? <ListBlock table="equipment" rows={d.equipment} kind="equipment" branchOpts={branchOpts} /> : null}
      {tab === 'safety' ? <div className="max-w-2xl"><p className="mb-3 text-sm text-muted">Shown on every job briefing so the crew knows where to go. Add the closest emergency room for each branch.</p><ListBlock table="hospitals" rows={d.hospitals} kind="hospitals" branchOpts={branchOpts} /></div> : null}
      {tab === 'products' ? <div className="max-w-2xl"><p className="mb-3 text-sm text-muted">Each record copies the product’s name and EPA number at the time, so editing a product never changes a past record.</p><ListBlock table="products" rows={d.products} kind="products" /></div> : null}
      {tab === 'certificates' ? (
        <div className="max-w-2xl">
          <p className="mb-3 text-sm text-muted">Yours and your subs’. Warned 30 days before the end date; nothing is blocked.</p>
          <ListBlock table="certificates" rows={d.certificates.map((c) => ({ ...c, state: certState(c.expires_on, today) }))} kind="certificates" />
        </div>
      ) : null}
      {tab === 'rules' ? (
        <div className="max-w-3xl">
          <p className="mb-3 text-sm text-muted">Rules decide which checks a job gets when the customer approves. Shared rules come with Tree Ops; only ones marked verified were checked against a source. Add your city’s permit rule here.</p>
          <ul className="mb-4 space-y-2 text-sm">{d.rules.filter((r) => !r.tenant_id).map((r) => <li key={r.id} className="rounded-control border border-line-faint bg-surface p-2"><Badge tone={r.verified ? 'green' : 'gray'}>{r.verified ? 'Verified' : 'Not verified'}</Badge> <strong>{r.kind}</strong> {r.city ? `${r.city}, ` : ''}{r.state_code ?? 'everywhere'}: {r.source_note}</li>)}</ul>
          <ListBlock table="prework_rules" rows={d.rules.filter((r) => r.tenant_id)} kind="rules" />
        </div>
      ) : null}
      {tab === 'branches' ? <div className="max-w-2xl"><ListBlock table="branches" rows={d.branches} kind="branches" /></div> : null}
      {tab === 'logins' ? (
        <div className="max-w-2xl">
          <p className="mb-3 text-sm text-muted">Office staff, sales arborists and admins sign in. Crews don’t: they get a link for each job day. Nothing is emailed; give each person their first password yourself, or use single sign-on.</p>
          <ul className="mb-4 divide-y divide-line-faint rounded-surface border border-line-faint bg-surface">{d.members.map((m) => <li key={m.id} className="flex items-center gap-2 p-3 text-sm"><span className="flex-1">{emails.get(m.user_id) ?? 'Unknown'}</span><Badge tone="gray">{ROLE_WORDS[m.role as keyof typeof ROLE_WORDS]}</Badge></li>)}</ul>
          {owner ? <Members memberIds={d.members.filter((m) => m.user_id !== ctx.userId).map((m) => ({ id: m.id, email: emails.get(m.user_id) ?? '' }))} branchOpts={branchOpts} /> : null}
        </div>
      ) : null}
      {tab === 'export' ? (
        <div className="max-w-2xl">
          <p className="mb-3 text-sm text-muted">Your data is yours. Download any table as a spreadsheet (owner and enterprise admin).</p>
          <div className="flex flex-wrap gap-2">{['customers', 'properties', 'trees', 'estimates', 'estimate_lines', 'jobs', 'prework_checks', 'job_days', 'briefings', 'briefing_signoffs', 'work_log', 'tree_confirmations', 'change_orders', 'invoices', 'payments', 'phc_applications', 'photos', 'messages', 'consents', 'audit_log'].map((t) => <a key={t} href={`/api/export/${t}.csv`} className="rounded-control border border-line bg-surface px-3 py-2 text-sm">{t.replace(/_/g, ' ')}</a>)}</div>
        </div>
      ) : null}
      {tab === 'system' ? (
        <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
          <Card><Eyebrow>Texts that failed</Eyebrow>{d.failed.length ? <ul className="mt-2 space-y-1 text-sm">{d.failed.map((m) => <li key={m.id}>{fmtTime(m.created_at, ctx.tenant.timezone)} · {m.template} to {prettyPhone(m.to_phone)}: {m.error}</li>)}</ul> : <p className="mt-2 text-sm text-muted">None.</p>}<p className="mt-2 text-xs text-muted">{d.blocked[0]!.n} texts in the last 30 days were held because the person hadn’t said OK to texts.</p></Card>
          <Card><Eyebrow>Background jobs that gave up</Eyebrow>{dead.length ? <ul className="mt-2 space-y-1 text-sm">{dead.map((j, i) => <li key={i}>{fmtDay(new Date(j.created_at).toISOString().slice(0, 10))} · {j.kind}: {j.last_error}</li>)}</ul> : <p className="mt-2 text-sm text-muted">None.</p>}</Card>
        </div>
      ) : null}
    </div>
  );
}
