import { Wordmark } from '@treeops/ui';
import { redirect } from 'next/navigation';
import { contextFor, currentUser } from '@/lib/auth';
import { OnboardingForm } from './onboarding-form';

export const metadata = { title: 'Set up your company' };

export default async function Onboarding() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (await contextFor(user)) redirect('/dashboard');
  return (
    <div className="min-h-dvh bg-page">
      <header className="bg-slate-900 px-4 py-3"><Wordmark /></header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-3xl font-semibold">Set up your company</h1>
        <p className="mt-1 text-muted">About 15 minutes. Everything here can change later in Settings.</p>
        <OnboardingForm />
      </main>
    </div>
  );
}
