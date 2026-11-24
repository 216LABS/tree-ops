import { db } from '@treeops/db';
import { prettyPhone } from '@treeops/core/messages';
import { notFound } from 'next/navigation';
import { isLocalOrTest } from '@/lib/env';
import { DevLink } from './dev-link';

export const metadata = { title: 'Dev' };
export const dynamic = 'force-dynamic';

/** Local and test only: links into the demo as a crew or a customer, and every text the mocks "sent". */
export default async function Dev() {
  if (!isLocalOrTest()) notFound();
  const sql = db();
  const days = await sql`select jd.id, jd.day, jd.status, j.number, p.address, t.name as company from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id join tenants t on t.id = jd.tenant_id
    where jd.day between current_date - 1 and current_date + 7 order by jd.day limit 20`;
  const estimates = await sql`select e.id, e.number, e.status, p.address from estimates e join properties p on p.id = e.property_id where e.status in ('sent','approved') order by e.created_at desc limit 10`;
  const invoices = await sql`select id, number, status, total_cents from invoices where status in ('sent','draft','paid') order by created_at desc limit 10`;
  const messages = await sql`select created_at, to_phone, template, status, body from messages order by created_at desc limit 40`;
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <h1 className="font-display text-3xl font-semibold">Dev</h1>
      <section>
        <h2 className="font-display text-xl font-semibold">Crew links</h2>
        <ul className="mt-2 space-y-2">{days.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{d.day} · job {d.number} · {d.address} ({d.status})</span><DevLink kind="crew" id={d.id} label="Open as crew" /></li>)}</ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Customer links</h2>
        <ul className="mt-2 space-y-2">{estimates.map((e) => <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm"><span>Estimate {e.number} ({e.status}) · {e.address}</span><DevLink kind="estimate" id={e.id} label="Open as customer" /></li>)}</ul>
        <ul className="mt-2 space-y-2">{invoices.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm"><span>Invoice {i.number} ({i.status})</span><DevLink kind="invoice" id={i.id} label="Open invoice" /></li>)}</ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Texts (mock inbox)</h2>
        <ul className="mt-2 space-y-2 text-sm" data-testid="inbox">{messages.map((m, i) => <li key={i} className="rounded-control border border-line-faint bg-surface p-2"><span className="text-muted">{new Date(m.created_at).toLocaleString()} → {prettyPhone(m.to_phone)} · {m.template} · {m.status}</span><br />{m.body}</li>)}</ul>
      </section>
    </main>
  );
}
