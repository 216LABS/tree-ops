import { prettyPhone } from '@treeops/core/messages';
import { shortDollars } from '@treeops/core/money';
import { Badge, Card, Eyebrow, PageHeader, Table, Td, Th } from '@treeops/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asUser, requirePage } from '@/lib/auth';
import { consentFor } from '@/lib/messaging';
import { EST_STATUS, fmtDate, JOB_STATUS } from '@/lib/format';
import { AddProperty, ConsentButtons } from './customer-actions';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage();
  const { id } = await params;
  const d = await asUser(ctx, async (tx) => {
    const [c] = await tx`select * from customers where id = ${id}`;
    if (!c) return null;
    return {
      c,
      props: await tx`select p.*, (select count(*)::int from trees t where t.property_id = p.id) as trees from properties p where p.customer_id = ${id} order by p.created_at`,
      estimates: await tx`select e.id, e.number, e.status, e.total_cents, e.created_at, p.address from estimates e join properties p on p.id = e.property_id where p.customer_id = ${id} order by e.created_at desc`,
      jobs: await tx`select j.id, j.number, j.status, p.address from jobs j join properties p on p.id = j.property_id where p.customer_id = ${id} order by j.created_at desc`,
      consent: c.phone ? await consentFor(tx, ctx.tenantId, c.phone) : null,
    };
  });
  if (!d) notFound();
  const { c } = d;
  return (
    <div>
      <PageHeader title={c.name} subtitle={`${c.kind.replace('_', ' ')}${c.locale === 'es' ? ' · prefers Spanish' : ''}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <Eyebrow>Reach them</Eyebrow>
          {c.phone ? <p className="mt-2 text-lg"><a className="text-link underline" href={`tel:${c.phone}`}>{prettyPhone(c.phone)}</a></p> : <p className="mt-2 text-muted">No phone yet.</p>}
          {c.email ? <p className="text-sm">{c.email}</p> : null}
          <p className="mt-2 text-sm">Texts: <strong>{d.consent === 'opted_in' ? 'OK to text' : d.consent === 'opted_out' ? 'Said stop' : 'Not asked yet'}</strong></p>
          {c.phone ? <ConsentButtons phone={c.phone} current={d.consent} /> : null}
          {c.billing_terms_days ? <p className="mt-2 text-sm text-muted">Invoices due in {c.billing_terms_days} days.</p> : null}
          {c.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{c.notes}</p> : null}
        </Card>
        <div>
          <div className="mb-2 flex items-center justify-between"><Eyebrow>Properties</Eyebrow><AddProperty customerId={c.id} stateCode={ctx.tenant.state_code} /></div>
          <ul className="space-y-2">
            {d.props.map((p) => (
              <li key={p.id}><Link href={`/properties/${p.id}`} className="block rounded-surface border border-line-faint bg-surface p-3 shadow-float hover:border-line-strong"><span className="font-semibold">{p.address}</span>{p.city ? `, ${p.city}` : ''} <span className="text-sm text-muted">· {p.trees} trees pinned</span></Link></li>
            ))}
            {!d.props.length ? <li className="text-sm text-muted">No property yet. Add one to start an estimate.</li> : null}
          </ul>
        </div>
      </div>
      <Eyebrow className="mb-2 mt-8">Estimates</Eyebrow>
      {d.estimates.length ? (
        <Table stack>
          <thead><tr><Th>#</Th><Th>Property</Th><Th>Status</Th><Th>Total</Th><Th>Made</Th></tr></thead>
          <tbody>{d.estimates.map((e) => <tr key={e.id}><Td label="#"><Link className="text-link underline" href={`/estimates/${e.id}`}>{e.number}</Link></Td><Td label="Property">{e.address}</Td><Td label="Status"><Badge tone={EST_STATUS[e.status]![1]}>{EST_STATUS[e.status]![0]}</Badge></Td><Td label="Total">{shortDollars(e.total_cents)}</Td><Td label="Made">{fmtDate(e.created_at, ctx.tenant.timezone)}</Td></tr>)}</tbody>
        </Table>
      ) : <p className="text-sm text-muted">None yet.</p>}
      <Eyebrow className="mb-2 mt-8">Jobs</Eyebrow>
      {d.jobs.length ? (
        <ul className="space-y-1">{d.jobs.map((j) => <li key={j.id}><Link className="text-link underline" href={`/jobs/${j.id}`}>Job {j.number}</Link> · {j.address} · <Badge tone={JOB_STATUS[j.status]![1]}>{JOB_STATUS[j.status]![0]}</Badge></li>)}</ul>
      ) : <p className="text-sm text-muted">None yet.</p>}
    </div>
  );
}
