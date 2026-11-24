import { copyDaysLeft, profileFor } from '@treeops/core/phc';
import { Badge, EmptyState, Eyebrow, PageHeader, Table, Td, Th } from '@treeops/ui';
import { asUser, requirePage } from '@/lib/auth';
import { fmtDay, todayIn } from '@/lib/format';
import { PhcForm, SendCopy } from './phc-form';

export const metadata = { title: 'Plant health care' };

/** Treatment records (docs/SPEC.md screen 11): the legal record is written as the tech taps through. */
export default async function Phc({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const today = todayIn(ctx.tenant.timezone);
  const d = await asUser(ctx, async (tx) => ({
    apps: await tx`select a.*, p.address, w.full_name as applicator, exists (select 1 from messages m where m.related_id = a.id and m.template = 'phc_copy' and m.status in ('sent','mock_sent')) as copy_sent
      from phc_applications a join properties p on p.id = a.property_id join workers w on w.id = a.applicator_worker_id order by a.applied_on desc, a.created_at desc limit 200`,
    properties: await tx`select p.id, p.address, p.state_code, c.name as customer from properties p join customers c on c.id = p.customer_id order by c.name limit 500`,
    products: await tx`select id, name, epa_reg_no, is_rup, default_unit from products where active order by name`,
    applicators: await tx`select id, full_name, applicator_license_no from workers where active and applicator_license_no is not null order by full_name`,
    programs: await tx`select pr.id, pr.property_id, pr.year from phc_programs pr where pr.status = 'active'`,
  }));
  return (
    <div>
      <PageHeader title="Plant health care" subtitle="Each treatment record holds what your state asks for; the customer gets a copy by text." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section>
          <Eyebrow className="mb-2">Record a treatment</Eyebrow>
          {d.products.length && d.applicators.length ? (
            <PhcForm properties={d.properties as never} products={d.products as never} applicators={d.applicators as never} programs={d.programs as never} defaultProperty={sp.property ?? null} today={today} />
          ) : (
            <EmptyState title="Add products and a licensed applicator first" body="Settings: Products (with EPA numbers) and Crew (with the applicator license number)." />
          )}
        </section>
        <section>
          <Eyebrow className="mb-2">Records</Eyebrow>
          {d.apps.length ? (
            <Table stack>
              <thead><tr><Th>Date</Th><Th>Where</Th><Th>Product</Th><Th>Customer copy</Th></tr></thead>
              <tbody>
                {d.apps.map((a) => {
                  const left = copyDaysLeft(a.applied_on, today, profileFor(a.state_code), a.is_rup);
                  return (
                    <tr key={a.id}>
                      <Td label="Date">{fmtDay(a.applied_on)}<div className="text-xs text-muted">{a.applicator}</div></Td>
                      <Td label="Where">{a.address}<div className="text-xs text-muted">{a.site_desc}</div></Td>
                      <Td label="Product">{a.product_name}<div className="text-xs text-muted">EPA {a.epa_reg_no} · {Number(a.total_amount)} {a.amount_unit}{a.is_rup ? ' · restricted use' : ''}</div></Td>
                      <Td label="Customer copy">
                        {a.copy_sent ? <Badge tone="green">Sent</Badge> : left === null ? <Badge tone="gray">Not required</Badge> : <Badge tone={left < 0 ? 'red' : left <= 5 ? 'amber' : 'gray'}>{left < 0 ? `${-left} days late` : `${left} days left`}</Badge>}
                        <SendCopy id={a.id} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : <p className="text-sm text-muted">No treatments recorded yet.</p>}
        </section>
      </div>
    </div>
  );
}
