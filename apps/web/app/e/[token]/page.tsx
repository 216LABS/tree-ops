import { db } from '@treeops/db';
import { priceEstimate } from '@treeops/core/pricing';
import { settingsOf } from '@treeops/core/settings';
import { notFound } from 'next/navigation';
import { estimateByToken, loadOptions } from '@/lib/estimates';
import { signedUrls } from '@/lib/storage';
import { Approve } from './approve';

export const metadata = { title: 'Your tree estimate', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** The customer's page (docs/SPEC.md screen 2): numbered tree photos first, then choices, total, deposit, signature. */
export default async function EstimateForCustomer({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params;
  const paid = (await searchParams).paid === '1';
  const e = await estimateByToken(token);
  if (!e) notFound();
  const sql = db();
  const options = await loadOptions(sql, e.id);
  const trees = await sql`select id, number, label, species_common, dbh_in from trees where property_id = ${e.property_id} and tenant_id = ${e.tenant_id} order by number`;
  const photos = await sql`select p.id, p.storage_path, m.tree_id, m.shape, m.number, m.color from photos p
    join lateral (select * from photo_markups pm where pm.photo_id = p.id and pm.tenant_id = p.tenant_id order by pm.created_at desc limit 1) m on true
    where p.estimate_id = ${e.id} and p.tenant_id = ${e.tenant_id} order by m.number`;
  const urls = await signedUrls('photos', photos.map((p) => p.storage_path as string), 3600);
  const [dep] = await sql`select amount_cents, status from deposits where estimate_id = ${e.id} and tenant_id = ${e.tenant_id}`;
  const tenant = e.tenant as { name: string; phone: string | null; settings: unknown; stripe_account_id: string | null };
  const settings = settingsOf(tenant.settings);
  const usedTrees = new Set(options.flatMap((o) => o.lines.map((l) => l.tree_id)).filter(Boolean));
  return (
    <Approve
      token={token}
      locale={(e.locale as 'en' | 'es') ?? 'en'}
      company={{ name: tenant.name, phone: tenant.phone, cards: Boolean(tenant.stripe_account_id) }}
      estimate={{ number: e.number, status: e.status, validUntil: e.valid_until, notes: e.notes, depositPct: e.deposit_pct, address: `${e.address}${e.city ? `, ${e.city}` : ''}`, customer: e.customer_name, minJobCents: settings.min_job_cents, approvedTotal: e.status === 'approved' ? priceEstimate(options, settings, e.deposit_pct).totalCents : null }}
      options={options}
      trees={trees.filter((t) => usedTrees.has(t.id)).map((t) => ({ id: t.id, number: t.number, label: t.label, species: t.species_common, dbh: t.dbh_in === null ? null : Number(t.dbh_in), photos: photos.filter((p) => p.tree_id === t.id).map((p) => ({ id: p.id, url: urls.get(p.storage_path) ?? null, mark: { shape: p.shape, number: p.number, color: p.color } })) }))}
      deposit={dep ? { cents: dep.amount_cents, status: dep.status } : null}
      paid={paid}
    />
  );
}
