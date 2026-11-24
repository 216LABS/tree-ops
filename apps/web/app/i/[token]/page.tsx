import { prettyPhone } from '@treeops/core/messages';
import { dollars } from '@treeops/core/money';
import { notFound } from 'next/navigation';
import { invoiceByToken } from '@/lib/billing';
import { PayButton } from './pay';

export const metadata = { title: 'Your invoice', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function InvoiceForCustomer({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params;
  const justPaid = (await searchParams).paid === '1';
  const inv = await invoiceByToken(token);
  if (!inv) notFound();
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <p className="font-display text-2xl font-semibold">{inv.company}</p>
      <p className="text-sm text-muted">Invoice {inv.number} · {inv.customer_name} · {inv.address}</p>
      <ul className="divide-y divide-line-faint rounded-surface bg-surface p-4 text-sm shadow-float">
        {(inv.lines as { description: string; amount_cents: number }[]).map((l, i) => <li key={i} className="flex justify-between gap-3 py-1.5"><span>{l.description}</span><span>{dollars(l.amount_cents)}</span></li>)}
        {inv.deposit_applied_cents ? <li className="flex justify-between py-1.5"><span>Deposit paid</span><span>-{dollars(inv.deposit_applied_cents)}</span></li> : null}
        <li className="flex justify-between py-2 text-lg font-semibold"><span>Total due</span><span data-testid="due">{dollars(inv.total_cents)}</span></li>
      </ul>
      {inv.status === 'paid' || justPaid ? <p className="rounded-control bg-ok-tint p-3 font-semibold text-ok-ink" data-testid="paid">{inv.status === 'paid' ? 'Paid. Thank you.' : 'Payment received. Thank you. It may take a minute to show.'}</p> : inv.status === 'void' ? <p className="rounded-control bg-tint-2 p-3">This invoice was cancelled.</p> : inv.stripe_account_id ? <PayButton token={token} label={`Pay ${dollars(inv.total_cents)}`} /> : <p className="text-sm">Pay by check or call {prettyPhone(inv.company_phone)}.</p>}
      {inv.due_date ? <p className="text-xs text-muted">Due {inv.due_date}.</p> : null}
    </main>
  );
}
