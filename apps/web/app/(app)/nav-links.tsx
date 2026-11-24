'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ links }: { links: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2" aria-label="Main">
      {links.map(([href, label]) => {
        const on = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={on ? 'page' : undefined} className={`whitespace-nowrap rounded-control px-3 py-2 text-sm font-semibold ${on ? 'bg-beacon text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
