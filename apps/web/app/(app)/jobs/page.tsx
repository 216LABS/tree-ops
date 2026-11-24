import { shortDollars } from '@treeops/core/money';
import { Badge, EmptyState, PageHeader, Table, Td, Th } from '@treeops/ui';
import Link from 'next/link';
import { asUser, requirePage } from '@/lib/auth';
import { fmtDay, JOB_STATUS } from '@/lib/format';

export const metadata = { title: 'Jobs' };

export default async function Jobs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requirePage();
  const status = (await searchParams).status;
  const rows = await asUser(ctx, (tx) => tx`
    select j.id, j.number, j.status, p.address, c.name as customer, e.total_cents,
      (select min(day) from job_days jd where jd.job_id = j.id and jd.status <> 'closed') as next_day,
      (select count(*)::int from prework_checks pc where pc.job_id = j.id and pc.status in ('needed','requested')) as open_checks
    from jobs j join properties p on p.id = j.property_id join customers c on c.id = p.customer_id join estimates e on e.id = j.estimate_id
    where ${status && JOB_STATUS[status] ? tx`j.status = ${status}` : tx`j.status <> 'cancelled'`}
    order by case j.status when 'in_progress' then 0 when 'scheduled' then 1 when 'unscheduled' then 2 when 'done' then 3 else 4 end, j.number desc limit 300`);
  return (
    <div>
      <PageHeader title="Jobs" />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {[['', 'All'], ...Object.entries(JOB_STATUS).map(([k, v]) => [k, v[0]])].map(([k, label]) => (
          <Link key={k} href={k ? `/jobs?status=${k}` : '/jobs'} className={`rounded-control px-3 py-1.5 ${status === k || (!status && !k) ? 'bg-ink text-surface' : 'bg-tint-2'}`}>{label}</Link>
        ))}
      </nav>
      {rows.length ? (
        <Table stack>
          <thead><tr><Th>Job</Th><Th>Customer</Th><Th>Status</Th><Th>Next day</Th><Th>Checks</Th><Th>Estimate</Th></tr></thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id}>
                <Td label="Job"><Link className="font-semibold text-link underline" href={`/jobs/${j.id}`}>{j.number}</Link></Td>
                <Td label="Customer">{j.customer}<div className="text-xs text-muted">{j.address}</div></Td>
                <Td label="Status"><Badge tone={JOB_STATUS[j.status]![1]}>{JOB_STATUS[j.status]![0]}</Badge></Td>
                <Td label="Next day">{fmtDay(j.next_day)}</Td>
                <Td label="Checks">{j.open_checks ? <Badge tone="amber">{j.open_checks} open</Badge> : ''}</Td>
                <Td label="Estimate">{shortDollars(j.total_cents)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <EmptyState title="No jobs here" body="A job appears when a customer approves an estimate." />}
    </div>
  );
}
