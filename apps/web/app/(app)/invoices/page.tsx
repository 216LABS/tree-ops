import { dollars } from '@treeops/core/money';
import { Badge, EmptyState, PageHeader, Table, Td, Th } from '@treeops/ui';
import Link from 'next/link';
import { asUser, requirePage } from '@/lib/auth';
import { fmtDate, INV_STATUS } from '@/lib/format';

export const metadata = { title: 'Invoices' };

export default async function Invoices() {
  const ctx = await requirePage();
  const rows = await asUser(ctx, (tx) => tx`select i.id, i.number, i.status, i.total_cents, i.due_date, i.sent_at, jsonb_array_length(i.flags) as flags, j.number as job, c.name as customer
    from invoices i join jobs j on j.id = i.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id
    order by case i.status when 'draft' then 0 when 'sent' then 1 else 2 end, i.created_at desc limit 300`);
  return (
    <div>
      <PageHeader title="Invoices" />
      {rows.length ? (
        <Table stack>
          <thead><tr><Th>#</Th><Th>Customer</Th><Th>Status</Th><Th>Total</Th><Th>Due</Th></tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.id}>
              <Td label="#"><Link className="font-semibold text-link underline" href={`/invoices/${i.id}`}>{i.number}</Link> <span className="text-xs text-muted">job {i.job}</span></Td>
              <Td label="Customer">{i.customer}</Td>
              <Td label="Status"><Badge tone={INV_STATUS[i.status]![1]}>{INV_STATUS[i.status]![0]}</Badge>{i.flags && i.status === 'draft' ? <Badge tone="amber" className="ml-1">{i.flags} flags</Badge> : null}</Td>
              <Td label="Total">{dollars(i.total_cents)}</Td>
              <Td label="Due">{i.due_date ? fmtDate(`${i.due_date}T12:00:00Z`, ctx.tenant.timezone) : ''}</Td>
            </tr>
          ))}</tbody>
        </Table>
      ) : <EmptyState title="No invoices yet" body="Close a finished job to make its invoice." />}
    </div>
  );
}
