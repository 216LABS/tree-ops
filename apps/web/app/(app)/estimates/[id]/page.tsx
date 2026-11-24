import { priceEstimate } from '@treeops/core/pricing';
import { dollars } from '@treeops/core/money';
import { notFound } from 'next/navigation';
import { asUser, requirePage } from '@/lib/auth';
import { loadOptions } from '@/lib/estimates';
import { signedUrls } from '@/lib/storage';
import { satelliteTiles } from '@/lib/tiles';
import { Builder, type DraftState } from './builder';
import { EstimateView } from './view';

export const metadata = { title: 'Estimate' };

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage();
  const { id } = await params;
  const d = await asUser(ctx, async (tx) => {
    const [e] = await tx`select e.*, p.address, p.city, p.state_code, p.lat, p.lon, p.id as property_id, c.name as customer, c.phone from estimates e join properties p on p.id = e.property_id join customers c on c.id = p.customer_id where e.id = ${id}`;
    if (!e) return null;
    const trees = await tx`select * from trees where property_id = ${e.property_id} order by number`;
    const photos = await tx`select p.id, p.client_id, p.tree_id, p.storage_path, m.shape, m.number, m.color, m.tree_id as mark_tree
      from photos p left join lateral (select * from photo_markups pm where pm.photo_id = p.id order by pm.created_at desc limit 1) m on true
      where p.estimate_id = ${id} and p.kind = 'estimate' order by p.taken_at`;
    const species = await tx`select common_name, latin_name, is_pine from species order by common_name`;
    const sig = await tx`select signer_name, signed_at from signatures where subject_type = 'estimate' and subject_id = ${id} order by signed_at desc limit 1`;
    const [job] = await tx`select id, number from jobs where estimate_id = ${id}`;
    return { e, trees, photos, species, options: await loadOptions(tx, id), sig: sig[0] ?? null, job: job ?? null };
  });
  if (!d) notFound();
  const urls = await signedUrls('photos', d.photos.map((p) => p.storage_path as string), 3600 * 12);
  const photos = d.photos.map((p) => ({ clientId: p.client_id as string, serverId: p.id as string, treeId: (p.mark_tree ?? p.tree_id) as string | null, url: urls.get(p.storage_path) ?? null, uploaded: true, mark: p.shape ? { shape: p.shape, number: p.number as number, color: p.color as string, saved: true } : null }));
  const trees = d.trees.map((t) => ({ id: t.id as string, number: t.number as number, label: t.label as string, speciesCommon: t.species_common, speciesLatin: t.species_latin, dbhIn: t.dbh_in === null ? null : Number(t.dbh_in), heightFt: t.height_ft, lat: t.lat === null ? null : Number(t.lat), lon: t.lon === null ? null : Number(t.lon), condition: t.condition, nearLines: t.near_lines, notes: t.notes }));
  const options = d.options.map((o) => ({ id: o.id, name: o.name, required: o.required, selected: o.selected, lines: o.lines.map((l) => ({ id: l.id, treeId: l.tree_id ?? null, kind: l.kind, description: l.description, qty: l.qty, unit: l.unit, unitPriceCents: l.unit_price_cents, estCrewHours: l.est_crew_hours ?? null, equipmentType: l.equipment_type ?? null })) }));
  const head = { id, number: d.e.number as number, status: d.e.status as string, propertyId: d.e.property_id as string, address: `${d.e.address}${d.e.city ? `, ${d.e.city}` : ''}`, customer: d.e.customer as string, phone: d.e.phone as string | null, center: { lat: Number(d.e.lat ?? 41.15), lon: Number(d.e.lon ?? -81.36) }, hasLocation: d.e.lat !== null };

  if (d.e.status !== 'draft') {
    const priced = priceEstimate(d.options, ctx.settings, d.e.deposit_pct);
    return <EstimateView head={head} trees={trees} photos={photos} options={options} total={dollars(priced.totalCents)} deposit={priced.depositCents ? dollars(priced.depositCents) : null} sig={d.sig ? { name: d.sig.signer_name, at: new Date(d.sig.signed_at).toLocaleString('en-US', { timeZone: ctx.tenant.timezone }) } : null} job={d.job as { id: string; number: number } | null} />;
  }
  const server: DraftState = { trees, options, photos, depositPct: d.e.deposit_pct, validUntil: d.e.valid_until, notes: d.e.notes, updatedAt: new Date(d.e.updated_at).toISOString() };
  return <Builder head={head} server={server} species={d.species.map((s) => ({ common: s.common_name, latin: s.latin_name, pine: s.is_pine }))} minJobCents={ctx.settings.min_job_cents} tiles={satelliteTiles()} />;
}
