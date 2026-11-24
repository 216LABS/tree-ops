import { Wordmark } from '@treeops/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/"><Wordmark /></Link>
          <nav className="ml-auto flex gap-4 text-sm">
            <Link href="/pricing">Pricing</Link>
            <Link href="/tools/tree-job-briefing-form">Free briefing form</Link>
            <Link href="/login" className="rounded-control bg-beacon px-3 py-1.5 font-semibold text-slate-950">Sign in</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-line-faint py-8 text-center text-sm text-muted">
        <p>Tree Ops by 216LABS · <Link href="/legal/terms">Terms</Link> · <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/sms-terms">Text message terms</Link></p>
      </footer>
    </div>
  );
}
