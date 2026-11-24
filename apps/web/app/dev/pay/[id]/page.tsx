import { dollars } from '@treeops/core/money';
import { notFound } from 'next/navigation';
import { isMock, isProd } from '@/lib/env';
import { MockPay } from './mock-pay';

export const metadata = { title: 'Mock payment' };

/** Mock checkout: stands in for Stripe's hosted page in mock mode. */
export default async function DevPay({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  if (isProd() || !isMock()) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const amount = Number(sp.amount ?? 0);
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="rounded-control bg-amber-200 p-2 text-sm font-semibold">Mock payment page. No real card is charged.</p>
      <h1 className="font-display mt-4 text-2xl font-semibold">{sp.desc}</h1>
      <p className="font-display mt-2 text-4xl font-semibold">{dollars(amount)}</p>
      <p className="mt-1 text-sm text-muted">Platform fee (shown here for testing only): {dollars(Number(sp.fee ?? 0))}</p>
      <MockPay sessionId={id} amount={amount} meta={JSON.parse(sp.meta ?? '{}')} success={sp.success ?? '/'} />
    </main>
  );
}
