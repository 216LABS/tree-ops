import { prettyPhone } from '@treeops/core/messages';
import { EmptyState, PageHeader, Table, Td, Th } from '@treeops/ui';
import Link from 'next/link';
import { asUser, requirePage } from '@/lib/auth';
import { NewCustomer } from './new-customer';

export const metadata = { title: 'Customers' };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requirePage();
  const q = ((await searchParams).q ?? '').trim();
  const rows = await asUser(ctx, (tx) => tx`
    select c.id, c.name, c.kind, c.phone, (select count(*)::int from properties p where p.customer_id = c.id) as properties,
      (select p.address from properties p where p.customer_id = c.id order by p.created_at limit 1) as address,
      (select count(*)::int from estimates e join properties p on p.id = e.property_id where p.customer_id = c.id and e.status = 'sent') as open_estimates
    from customers c
    where ${q ? tx`(c.name ilike ${'%' + q + '%'} or c.phone ilike ${'%' + q.replace(/\D/g, '') + '%'} or exists (select 1 from properties p where p.customer_id = c.id and p.address ilike ${'%' + q + '%'}))` : tx`true`}
    order by c.created_at desc limit 200`);
  return (
    <div>
      <PageHeader title="Customers" actions={<NewCustomer stateCode={ctx.tenant.state_code} />} />
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Search name, phone or address" className="block w-full max-w-md rounded-control border border-line-strong bg-surface px-3 py-2 text-base" aria-label="Search customers" />
      </form>
      {rows.length ? (
        <Table stack>
          <thead><tr><Th>Name</Th><Th>Address</Th><Th>Phone</Th><Th>Open estimates</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td label="Name"><Link className="font-semibold text-link underline" href={`/customers/${r.id}`}>{r.name}</Link> <span className="text-xs text-muted">{r.kind.replace('_', ' ')}</span></Td>
                <Td label="Address">{r.address ?? 'No property yet'}{r.properties > 1 ? ` and ${r.properties - 1} more` : ''}</Td>
                <Td label="Phone">{prettyPhone(r.phone)}</Td>
                <Td label="Open estimates">{r.open_estimates || ''}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title={q ? 'No customers match that' : 'No customers yet'} body={q ? 'Try part of the name or street.' : 'Add your first customer and their property, then walk it and pin the trees.'} />
      )}
    </div>
  );
}
