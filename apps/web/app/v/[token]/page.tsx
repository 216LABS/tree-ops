import { db } from '@treeops/db';
import { notFound } from 'next/navigation';
import { signedUrl, signedUrls } from '@/lib/storage';
import { hashToken } from '@/lib/tokens';

export const metadata = { title: 'Job record', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Read-only job record for an adjuster, HOA or lawyer (docs/SPEC.md section 9, GET /v/:token). No login. */
export default async function Viewer({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sql = db();
  const [c] = await sql`select cl.*, t.name as company, t.timezone, j.number as job_number, p.address, p.id as property_id from claims cl join tenants t on t.id = cl.tenant_id
    left join jobs j on j.id = cl.job_id left join properties p on p.id = j.property_id where cl.viewer_token_hash = ${hashToken(token)}`;
  if (!c) notFound();
  const packets = c.job_id ? await sql`select sha256, pdf_path, created_at from proof_packets where job_id = ${c.job_id} and tenant_id = ${c.tenant_id} order by created_at desc limit 5` : [];
  const packetUrls = await Promise.all(packets.map((p) => signedUrl('packets', p.pdf_path)));
  const photos = c.job_id ? await sql`select id, kind, storage_path, taken_at, sha256 from photos where tenant_id = ${c.tenant_id} and (job_day_id in (select id from job_days where job_id = ${c.job_id}) or estimate_id = (select estimate_id from jobs where id = ${c.job_id})) order by taken_at` : [];
  const urls = await signedUrls('photos', photos.map((p) => p.storage_path as string), 1800);
  const when = (d: Date) => new Date(d).toLocaleString('en-US', { timeZone: c.timezone, dateStyle: 'medium', timeStyle: 'short' });
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="font-display text-2xl font-semibold">{c.company}</p>
      <h1 className="mt-1 text-lg">Job record{c.job_number ? ` for job ${c.job_number}` : ''}{c.address ? `, ${c.address}` : ''}</h1>
      <p className="mt-2 text-sm">Claim opened {c.opened_on}: {c.kind.replace('_', ' ')}. {c.description}</p>
      <h2 className="font-display mt-6 text-lg font-semibold">Proof packets</h2>
      {packets.length ? <ul className="mt-1 space-y-1 text-sm">{packets.map((p, i) => <li key={i}>{packetUrls[i] ? <a className="text-link underline" href={packetUrls[i]!}>Proof packet, {when(p.created_at)}</a> : when(p.created_at)} <span className="font-mono text-xs">SHA-256 {p.sha256}</span></li>)}</ul> : <p className="text-sm text-muted">The company hasn’t built one yet.</p>}
      <h2 className="font-display mt-6 text-lg font-semibold">Photos</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => <figure key={p.id}>{urls.get(p.storage_path) ? <img src={urls.get(p.storage_path)} alt={p.kind} className="aspect-[4/3] w-full rounded object-cover" /> : null}<figcaption className="text-xs">{p.kind} · {when(p.taken_at)}<br /><span className="font-mono">{String(p.sha256).slice(0, 16)}…</span></figcaption></figure>)}
      </div>
    </main>
  );
}
