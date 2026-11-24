import { NEAR_LINES_WORDS } from '@treeops/core/electrical';
import { shortDollars } from '@treeops/core/money';
import { Badge, Card, Eyebrow, PageHeader, Table, Td, Th } from '@treeops/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/actions';
import { asUser, requirePage } from '@/lib/auth';
import { EST_STATUS, fmtDate, JOB_STATUS } from '@/lib/format';
import { NewEstimateButton } from './new-estimate';

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage();
  const { id } = await params;
  const d = await asUser(ctx, async (tx) => {
    const [p] = await tx`select p.*, c.name as customer, c.id as customer_id from properties p join customers c on c.id = p.customer_id where p.id = ${id}`;
    if (!p) return null;
    return {
      p,
      trees: await tx`select * from trees where property_id = ${id} order by number`,
      estimates: await tx`select id, number, status, total_cents, created_at from estimates where property_id = ${id} order by created_at desc`,
      jobs: await tx`select id, number, status from jobs where property_id = ${id} order by created_at desc`,
      phc: await tx`select a.applied_on, a.product_name, a.epa_reg_no, a.total_amount, a.amount_unit from phc_applications a where a.property_id = ${id} order by a.applied_on desc limit 10`,
    };
  });
  if (!d) notFound();
  const { p } = d;
  const draft = d.estimates.find((e) => e.status === 'draft');
  return (
    <div>
      <PageHeader title={p.address} subtitle={<Link className="text-link underline" href={`/customers/${p.customer_id}`}>{p.customer}</Link>} actions={draft ? <Link className="rounded-control bg-beacon px-4 py-2.5 font-semibold text-slate-950" href={`/estimates/${draft.id}`}>Open draft estimate {draft.number}</Link> : <NewEstimateButton propertyId={id} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <Eyebrow>For the crew</Eyebrow>
          <p className="mt-2 text-sm">{p.city ? `${p.city}, ` : ''}{p.state_code}{p.lat ? ` · ${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}` : ' · not pinned on the map yet'}</p>
          {p.hoa_name ? <p className="text-sm">HOA: {p.hoa_name}</p> : null}
          {p.gate_code ? <p className="text-sm">Gate code: {p.gate_code}</p> : null}
          {p.access_notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{p.access_notes}</p> : null}
          {(p.hazards as string[]).length ? <ul className="mt-2 list-inside list-disc text-sm text-warn-ink">{(p.hazards as string[]).map((h) => <li key={h}>{h}</li>)}</ul> : null}
        </Card>
        <div>
          <Eyebrow className="mb-2">Trees ({d.trees.length})</Eyebrow>
          {d.trees.length ? (
            <Table stack>
              <thead><tr><Th>#</Th><Th>Tree</Th><Th>DBH</Th><Th>Condition</Th><Th>Power lines</Th></tr></thead>
              <tbody>{d.trees.map((t) => <tr key={t.id}><Td label="#" className="font-display text-lg font-bold">{t.number}</Td><Td label="Tree">{t.species_common ?? t.label}</Td><Td label="DBH">{t.dbh_in ? `${t.dbh_in} in` : ''}</Td><Td label="Condition">{t.condition ?? ''}</Td><Td label="Power lines">{t.near_lines === 'none' ? 'None' : <Badge tone="amber">{NEAR_LINES_WORDS[t.near_lines as keyof typeof NEAR_LINES_WORDS]}</Badge>}</Td></tr>)}</tbody>
            </Table>
          ) : <p className="text-sm text-muted">No trees pinned yet. Start an estimate on site to pin and photograph them.</p>}
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <Eyebrow className="mb-2">Estimates</Eyebrow>
          <ul className="space-y-1">{d.estimates.map((e) => <li key={e.id}><Link className="text-link underline" href={`/estimates/${e.id}`}>Estimate {e.number}</Link> <Badge tone={EST_STATUS[e.status]![1]}>{EST_STATUS[e.status]![0]}</Badge> {shortDollars(e.total_cents)} · {fmtDate(e.created_at, ctx.tenant.timezone)}</li>)}</ul>
          {!d.estimates.length ? <p className="text-sm text-muted">None yet.</p> : null}
          <Eyebrow className="mb-2 mt-6">Jobs</Eyebrow>
          <ul className="space-y-1">{d.jobs.map((j) => <li key={j.id}><Link className="text-link underline" href={`/jobs/${j.id}`}>Job {j.number}</Link> <Badge tone={JOB_STATUS[j.status]![1]}>{JOB_STATUS[j.status]![0]}</Badge></li>)}</ul>
          {!d.jobs.length ? <p className="text-sm text-muted">None yet.</p> : null}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>Plant health care</Eyebrow>
            <ActionButton size="sm" variant="outline" path="/api/phc/programs" body={{ propertyId: id, year: new Date().getFullYear(), status: 'active' }}>Start this year’s program</ActionButton>
          </div>
          {d.phc.length ? <ul className="space-y-1 text-sm">{d.phc.map((a, i) => <li key={i}>{a.applied_on}: {a.product_name} (EPA {a.epa_reg_no}), {a.total_amount} {a.amount_unit}</li>)}</ul> : <p className="text-sm text-muted">No treatments recorded. <Link className="text-link underline" href={`/phc?property=${id}`}>Record one</Link></p>}
        </div>
      </div>
    </div>
  );
}
