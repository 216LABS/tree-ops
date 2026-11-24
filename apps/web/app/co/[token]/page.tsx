import { notFound } from 'next/navigation';
import { changeOrderByToken } from '@/lib/billing';
import { SignChangeOrder } from './sign';

export const metadata = { title: 'Added work', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ChangeOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const co = await changeOrderByToken(token);
  if (!co) notFound();
  return <SignChangeOrder token={token} co={{ company: co.company, customer: co.customer_name, address: co.address, job: co.job_number, description: co.description, amountCents: co.amount_cents, status: co.status }} />;
}
