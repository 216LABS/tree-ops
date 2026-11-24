import { feeFor } from '@/lib/estimates';
import { dollars } from '@treeops/core/money';
import { Badge, Card, Eyebrow, PageHeader } from '@treeops/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/actions';
import { asUser, requirePage } from '@/lib/auth';
import { fmtTime, INV_STATUS } from '@/lib/format';
import { ManualPayment, SendInvoice } from './invoice-actions';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage();
  const { id } = await params;
  const d = await asUser(ctx, async (tx) => {
    const [i] = await tx`select i.*, j.number as job_number, j.id as job_id, c.name as customer from invoices i join jobs j on j.id = i.job_id join properties p on p.id = j.property_id join customers c on c.id = p.customer_id where i.id = ${id}`;
    if (!i) return null;
    return { i, lines: await tx`select * from invoice_lines where invoice_id = ${id} order by sort`, payments: await tx`select * from payments where invoice_id = ${id} order by received_at` };
  });
  if (!d) notFound();
  const { i } = d;
  const flags = i.flags as { code: string; message: string }[];
  const paid = d.payments.reduce((s, p) => s + p.amount_cents, 0);
  const manager = ['owner', 'office'].includes(ctx.role);
  return (
    <div className="max-w-3xl">
      <PageHeader title={<>Invoice {i.number} <Badge tone={INV_STATUS[i.status]![1]} className="align-middle">{INV_STATUS[i.status]![0]}</Badge></>} subtitle={<>{i.customer} · <Link className="text-link underline" href={`/jobs/${i.job_id}`}>job {i.job_number}</Link></>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-4xl font-semibold" data-testid="invoice-total">{dollars(i.total_cents)}</span>
          <span className="text-sm text-muted">{i.deposit_applied_cents ? `${dollars(i.subtotal_cents)} less ${dollars(i.deposit_applied_cents)} deposit` : ''}</span>
        </div>
        {manager ? <p className="mt-1 text-xs text-muted">Platform fee if paid by card through Tree Ops: {dollars(feeFor(ctx.tenant, i.total_cents))} (only you see this).</p> : null}
      </Card>
      {flags.length ? (
        <Card className="mb-4 border-amber-400">
          <Eyebrow>Look at these first</Eyebrow>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm" data-testid="flags">{flags.map((f, k) => <li key={k}>{f.message}</li>)}</ul>
          {i.flags_ack_at ? <p className="mt-2 text-sm text-ok-ink">Reviewed {fmtTime(i.flags_ack_at, ctx.tenant.timezone)}.</p> : manager && i.status === 'draft' ? <div className="mt-3"><ActionButton variant="outline" path={`/api/invoices/${id}/ack`} testId="ack-flags">I’ve looked at these</ActionButton></div> : null}
          {i.status === 'draft' ? <p className="mt-2 text-xs text-muted">To change what’s billed, fix it on the job (sign a change order, confirm a tree) and rebuild the invoice there.</p> : null}
        </Card>
      ) : null}
      <Card className="mb-4">
        <Eyebrow>Lines</Eyebrow>
        <ul className="mt-2 divide-y divide-line-faint text-sm">{d.lines.map((l) => <li key={l.id} className="flex justify-between gap-4 py-1.5"><span>{l.description}</span><span className="tabular">{dollars(l.amount_cents)}</span></li>)}</ul>
      </Card>
      {manager && i.status !== 'void' && i.status !== 'paid' ? <SendInvoice id={id} status={i.status} blocked={flags.length > 0 && !i.flags_ack_at} /> : null}
      <Card className="mt-4">
        <Eyebrow>Payments</Eyebrow>
        {d.payments.length ? <ul className="mt-2 text-sm">{d.payments.map((p) => <li key={p.id}>{dollars(p.amount_cents)} by {p.method} · {fmtTime(p.received_at, ctx.tenant.timezone)}</li>)}</ul> : <p className="mt-1 text-sm text-muted">Nothing received yet.</p>}
        {manager && i.status === 'sent' ? <ManualPayment id={id} owed={Math.max(0, i.total_cents - paid)} /> : null}
      </Card>
      {manager && (i.status === 'draft' || i.status === 'sent') && !d.payments.length ? <div className="mt-8 border-t border-line-faint pt-4"><ActionButton variant="ghost" path={`/api/invoices/${id}/void`} confirm="Void this invoice? The job goes back to 'done, to bill'.">Void invoice</ActionButton></div> : null}
    </div>
  );
}
