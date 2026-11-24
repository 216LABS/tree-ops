import { estimateVsActual } from '@treeops/core/actual';
import { hoursToService } from '@treeops/core/equipment';
import { dollars } from '@treeops/core/money';
import { EmptyState, Eyebrow, PageHeader, Table, Td, Th } from '@treeops/ui';
import Link from 'next/link';
import { asUser, requirePage } from '@/lib/auth';
import { loadOptions } from '@/lib/estimates';
import { db } from '@treeops/db';

export const metadata = { title: 'Reports' };

/** Estimate vs actual (D1): did the job take the hours the estimate said? Per job, then per sales arborist. */
export default async function Reports() {
  const ctx = await requirePage();
  const d = await asUser(ctx, async (tx) => {
    const jobs = await tx`select j.id, j.number, j.estimate_id, e.total_cents, e.sales_user_id as seller from jobs j join estimates e on e.id = j.estimate_id
      where j.status in ('done','billed') order by j.closed_at desc nulls last limit 100`;
    const out: Record<string, any>[] = [];
    for (const j of jobs) {
      const opts = (await loadOptions(tx, j.estimate_id)).filter((o) => o.required || o.selected);
      const events = await tx`select worker_id, kind, at, value, equipment_id from work_log where job_day_id in (select id from job_days where job_id = ${j.id})`;
      const disposal = await tx`select coalesce(sum(cost_cents), 0)::int as c from disposal_tickets where job_day_id in (select id from job_days where job_id = ${j.id})`;
      out.push({ ...j, v: estimateVsActual(opts.flatMap((o) => o.lines), events as never), disposal: disposal[0]!.c as number });
    }
    return { jobs: out, equipment: await tx`select name, type, hour_meter, service_every_hours, last_service_hours from equipment where active order by type, name` };
  });
  // Sellers by email, read on the server connection (auth.users isn't visible to a signed-in session), this tenant only.
  const ids = [...new Set(d.jobs.map((j) => j.seller as string))];
  const emails = new Map((ids.length ? await db()`select u.id, u.email from auth.users u join memberships m on m.user_id = u.id and m.tenant_id = ${ctx.tenantId} where u.id = any(${ids})` : []).map((r) => [r.id as string, r.email as string]));
  for (const j of d.jobs) j.seller = emails.get(j.seller) ?? 'Former user';
  const bySeller = new Map<string, { jobs: number; est: number; act: number }>();
  for (const j of d.jobs) {
    if (!j.v.estHours) continue;
    const s = bySeller.get(j.seller) ?? { jobs: 0, est: 0, act: 0 };
    bySeller.set(j.seller, { jobs: s.jobs + 1, est: s.est + j.v.estHours, act: s.act + j.v.actualHours });
  }
  return (
    <div>
      <PageHeader title="Reports" subtitle="Crew hours from the crew link’s arrive and leave taps, against the hours on the estimate." />
      <Eyebrow className="mb-2">By sales arborist</Eyebrow>
      {bySeller.size ? (
        <Table stack className="mb-8">
          <thead><tr><Th>Who</Th><Th>Jobs</Th><Th>Estimated hours</Th><Th>Actual hours</Th><Th>Over or under</Th></tr></thead>
          <tbody>{[...bySeller].map(([who, s]) => <tr key={who}><Td label="Who">{who}</Td><Td label="Jobs">{s.jobs}</Td><Td label="Estimated">{s.est.toFixed(1)}</Td><Td label="Actual">{s.act.toFixed(1)}</Td><Td label="Over or under" className={s.act > s.est * 1.15 ? 'font-semibold text-danger-ink' : ''}>{s.est ? `${(((s.act - s.est) / s.est) * 100).toFixed(0)}%` : ''}</Td></tr>)}</tbody>
        </Table>
      ) : <p className="mb-8 text-sm text-muted">Shows once finished jobs had crew hours on their estimate lines.</p>}
      <Eyebrow className="mb-2">Finished jobs</Eyebrow>
      {d.jobs.length ? (
        <Table stack>
          <thead><tr><Th>Job</Th><Th>Estimate</Th><Th>Hours: estimated</Th><Th>Hours: actual</Th><Th>Difference</Th><Th>Dump fees</Th></tr></thead>
          <tbody>{d.jobs.map((j) => <tr key={j.id}><Td label="Job"><Link className="text-link underline" href={`/jobs/${j.id}`}>{j.number}</Link></Td><Td label="Estimate">{dollars(j.total_cents)}</Td><Td label="Estimated">{j.v.estHours || 'none set'}</Td><Td label="Actual">{j.v.actualHours}</Td><Td label="Difference">{j.v.variancePct === null ? '' : `${j.v.variancePct > 0 ? '+' : ''}${j.v.variancePct}%`}</Td><Td label="Dump fees">{j.disposal ? dollars(j.disposal) : ''}</Td></tr>)}</tbody>
        </Table>
      ) : <EmptyState title="No finished jobs yet" body="Close a job to see how it compared with its estimate." />}
      <Eyebrow className="mb-2 mt-8">Equipment hours</Eyebrow>
      <Table stack>
        <thead><tr><Th>Equipment</Th><Th>Hour meter</Th><Th>Next service</Th></tr></thead>
        <tbody>{d.equipment.map((e) => { const left = hoursToService(e as never); return <tr key={e.name}><Td label="Equipment">{e.name}</Td><Td label="Hour meter">{e.hour_meter ?? 'not set'}</Td><Td label="Next service">{left === null ? 'no interval set' : left <= 0 ? `${-left} h overdue` : `in ${left} h`}</Td></tr>; })}</tbody>
      </Table>
    </div>
  );
}
