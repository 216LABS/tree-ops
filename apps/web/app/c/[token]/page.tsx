import type { Metadata, Viewport } from 'next';
import { crewBundle, resolveLink } from '@/lib/crew';
import { HttpError } from '@/lib/http';
import { CrewApp } from './crew-app';

export const metadata: Metadata = { title: 'Today’s job', robots: { index: false }, manifest: undefined };
export const viewport: Viewport = { themeColor: '#0b151d', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export const dynamic = 'force-dynamic';

/** The crew link (docs/SPEC.md screen 4). No login, no install; works offline after the first open. */
export default async function CrewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let bundle: Awaited<ReturnType<typeof crewBundle>> | null = null;
  try {
    bundle = await crewBundle(await resolveLink(token));
  } catch (e) {
    if (!(e instanceof HttpError) || e.code !== 'gone') throw e;
  }
  if (!bundle) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div>
          <h1 className="font-display text-3xl font-bold">This link has ended</h1>
          <p className="mt-2 text-slate-300">Ask your office for a new one.</p>
          <p className="mt-1 text-slate-400">Este enlace ya no sirve. Pida uno nuevo a la oficina.</p>
        </div>
      </main>
    );
  }
  return <CrewApp token={token} initial={JSON.parse(JSON.stringify(bundle))} />;
}
