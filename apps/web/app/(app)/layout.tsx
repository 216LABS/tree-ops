import { Wordmark } from '@treeops/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { requirePage, ROLE_WORDS } from '@/lib/auth';
import { isMock } from '@/lib/env';
import { NavLinks } from './nav-links';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requirePage();
  const links: [string, string][] = [
    ['/dashboard', 'Today'],
    ['/customers', 'Customers'],
    ['/schedule', 'Schedule'],
    ['/jobs', 'Jobs'],
    ['/invoices', 'Invoices'],
    ['/phc', 'Plant health'],
    ['/storm', 'Storm'],
    ['/claims', 'Claims'],
    ['/reports', 'Reports'],
    ['/settings', 'Settings'],
  ];
  if (['owner', 'enterprise_admin'].includes(ctx.role)) links.push(['/audit', 'Audit']);
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-float">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <Link href="/dashboard" aria-label="Tree Ops home">
            <Wordmark className="text-xl" />
          </Link>
          <span className="hidden truncate text-sm text-slate-300 md:inline">{ctx.tenant.name}</span>
          {isMock() ? <span className="rounded-sm bg-amber-300 px-1.5 py-0.5 text-xs font-bold text-slate-900">MOCK MODE</span> : null}
          <form action="/api/auth/signout" method="post" className="ml-auto">
            <span className="mr-3 hidden text-xs text-slate-400 sm:inline">{ROLE_WORDS[ctx.role]}</span>
            <button className="min-h-10 rounded-control px-3 text-sm text-slate-200 hover:bg-slate-800">Sign out</button>
          </form>
        </div>
        <NavLinks links={links} />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
