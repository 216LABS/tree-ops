import { Wordmark } from '@treeops/ui';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { demoLoginEnabled } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await currentUser()) redirect('/dashboard');
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Wordmark />
        </div>
        <div className="rounded-surface bg-surface p-6 shadow-popup">
          <LoginForm demo={demoLoginEnabled()} />
        </div>
      </div>
    </div>
  );
}
