import { notFound } from 'next/navigation';
import { isMock, isProd } from '@/lib/env';
import { MockOnboard } from './mock-onboard';

export default async function DevOnboard({ searchParams }: { searchParams: Promise<{ account?: string; return?: string }> }) {
  if (isProd() || !isMock()) notFound();
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="rounded-control bg-amber-200 p-2 text-sm font-semibold">Mock Stripe onboarding.</p>
      <MockOnboard account={sp.account ?? ''} back={sp.return ?? '/settings'} />
    </main>
  );
}
