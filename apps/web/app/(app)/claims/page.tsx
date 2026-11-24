import { Badge, Card, EmptyState, PageHeader } from '@treeops/ui';
import Link from 'next/link';
import { ActionButton } from '@/components/actions';
import { asUser, requirePage } from '@/lib/auth';
import { fmtDay } from '@/lib/format';
import { ViewerLink } from './viewer-link';

export const metadata = { title: 'Claims' };

export default async function Claims() {
  const ctx = await requirePage();
  const rows = await asUser(ctx, (tx) => tx`select cl.*, j.number as job_number, p.address from claims cl left join jobs j on j.id = cl.job_id left join properties p on p.id = j.property_id order by cl.status, cl.opened_on desc`);
  const manager = ['owner', 'office'].includes(ctx.role);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Claims" subtitle="Open a claim from the job it’s about. Share a read-only link with the adjuster: the job record and its proof packets." />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.kind.replace('_', ' ')}</span>
                <Badge tone={c.status === 'open' ? 'amber' : 'green'}>{c.status}</Badge>
                <span className="text-sm text-muted">opened {fmtDay(c.opened_on)}</span>
                {c.job_id ? <Link className="text-sm text-link underline" href={`/jobs/${c.job_id}`}>job {c.job_number}, {c.address}</Link> : null}
              </div>
              <p className="mt-1 text-sm">{c.description}</p>
              {manager ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ViewerLink id={c.id} />
                  <ActionButton size="sm" variant="ghost" method="PATCH" path={`/api/claims/${c.id}`} body={{ status: c.status === 'open' ? 'closed' : 'open' }}>{c.status === 'open' ? 'Close claim' : 'Reopen'}</ActionButton>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No claims" body="If a customer reports damage, open a claim on that job. The proof packet shows the before photos and the record." />}
    </div>
  );
}
